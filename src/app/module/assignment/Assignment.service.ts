import httpStatus from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import type { AssignmentStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { AuditLogServices } from "../audit-log/audit-log.service";
import { NotificationEvents } from "../notification/notification.events";
import {
  IAssignmentQuery,
  IAvailableTechnicianQuery,
  ICancelAssignmentPayload,
  ICreateAssignmentPayload,
  IRescheduleAssignmentPayload,
} from "./Assignment.interface";
import { IRequestUser } from "../auth/auth.interface";

type Tx = Prisma.TransactionClient;

const ACTIVE_STATUSES: AssignmentStatus[] = ["PENDING", "CONFIRMED"];
const ALL_STATUSES: AssignmentStatus[] = ["PENDING", "CONFIRMED", "CANCELLED"];
const MAX_VISIT_HOURS = 12;
const SORTABLE_FIELDS = ["createdAt", "scheduledStart", "status"];

const assignmentInclude = {
  serviceRequest: {
    select: {
      id: true,
      title: true,
      description: true,
      priority: true,
      status: true,
      address: true,
      city: true,
      preferredDate: true,
      customer: {
        select: { id: true, name: true, contactNumber: true },
      },
    },
  },
  technician: {
    select: {
      id: true,
      name: true,
      email: true,
      contactNumber: true,
      user: { select: { imageUrl: true } },
    },
  },
  workOrder: { select: { id: true, status: true } },
} satisfies Prisma.AssignmentInclude;

const parseDate = (value: string, label: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(httpStatus.BAD_REQUEST, `${label} is not a valid date`);
  }
  return date;
};

const parsePagination = (query: IAssignmentQuery) => {
  const page = Math.max(Number.parseInt(query.page ?? "1", 10) || 1, 1);
  const limit = Math.min(
    Math.max(Number.parseInt(query.limit ?? "10", 10) || 10, 1),
    100,
  );
  const sortBy = SORTABLE_FIELDS.includes(query.sortBy ?? "")
    ? (query.sortBy as string)
    : "scheduledStart";
  const sortOrder: "asc" | "desc" = query.sortOrder === "asc" ? "asc" : "desc";
  return { page, limit, skip: (page - 1) * limit, sortBy, sortOrder };
};

const buildListFilters = (query: IAssignmentQuery) => {
  const and: Prisma.AssignmentWhereInput[] = [];

  if (query.status) {
    if (!ALL_STATUSES.includes(query.status as AssignmentStatus)) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Invalid status. Use one of: ${ALL_STATUSES.join(", ")}`,
      );
    }
    and.push({ status: query.status as AssignmentStatus });
  }
  if (query.technicianId) and.push({ technicianId: query.technicianId });
  if (query.serviceRequestId) {
    and.push({ serviceRequestId: query.serviceRequestId });
  }
  if (query.from) {
    and.push({ scheduledStart: { gte: parseDate(query.from, "from") } });
  }
  if (query.to) {
    and.push({ scheduledStart: { lte: parseDate(query.to, "to") } });
  }
  return and;
};

const validateVisitWindow = (start: Date, end: Date) => {
  if (end <= start) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "scheduledEnd must be after scheduledStart",
    );
  }
  if (start <= new Date()) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "scheduledStart must be in the future",
    );
  }
  const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  if (hours > MAX_VISIT_HOURS) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `A visit cannot be longer than ${MAX_VISIT_HOURS} hours`,
    );
  }
};

const ensureTechnicianEligible = async (tx: Tx, technicianId: string) => {
  const technician = await tx.technician.findUnique({
    where: { id: technicianId },
    include: { user: { select: { status: true, isDeleted: true } } },
  });

  if (!technician || technician.isDeleted || technician.user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, "Technician Not Found");
  }
  if (technician.verificationStatus !== "APPROVED") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Technician is not verified yet",
    );
  }
  if (technician.user.status !== "ACTIVE") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Technician account is not active",
    );
  }
  if (!technician.isAvailable) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Technician is currently marked as unavailable",
    );
  }
  return technician;
};

// Row-level lock on the technician. Two requests that try to book the SAME
// technician now run one after another (the 2nd waits until the 1st commits),
// so ensureNoConflict() below always sees the latest data.
// The DB exclusion constraint "no_technician_overlap" is the final safety net.
const lockTechnician = async (tx: Tx, technicianId: string) => {
  await tx.$queryRaw`SELECT "id" FROM "technicians" WHERE "id" = ${technicianId} FOR UPDATE`;
};

const ensureNoConflict = async (
  tx: Tx,
  technicianId: string,
  start: Date,
  end: Date,
  excludeAssignmentId?: string,
) => {
  await lockTechnician(tx, technicianId);

  const conflict = await tx.assignment.findFirst({
    where: {
      technicianId,
      status: { in: ACTIVE_STATUSES },
      scheduledStart: { lt: end },
      scheduledEnd: { gt: start },
      ...(excludeAssignmentId ? { id: { not: excludeAssignmentId } } : {}),
    },
    select: { scheduledStart: true, scheduledEnd: true },
  });

  if (conflict) {
    throw new AppError(
      httpStatus.CONFLICT,
      `Technician already has a visit from ${conflict.scheduledStart.toISOString()} to ${conflict.scheduledEnd.toISOString()}`,
    );
  }
};

// Collects message / code / meta / cause of an error into one string,
// so Postgres error codes can be detected however Prisma wraps them.
const collectErrorText = (error: unknown, depth = 0): string => {
  if (!error || depth > 4) return "";
  if (typeof error === "string") return error;
  if (typeof error !== "object") return String(error);

  const e = error as Record<string, unknown>;
  let meta = "";
  try {
    meta = JSON.stringify(e.meta ?? {});
  } catch {
    meta = "";
  }

  return [
    typeof e.message === "string" ? e.message : "",
    typeof e.code === "string" ? e.code : "",
    meta,
    collectErrorText(e.cause, depth + 1),
  ]
    .filter(Boolean)
    .join(" ");
};

// Converts DB constraint violations (race-condition losers) into clean 409 errors
const withConstraintErrors = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AppError) throw error;

    const text = collectErrorText(error);

    // exclusion_violation (23P01) => technician double-booked
    if (
      text.includes("no_technician_overlap") ||
      text.includes("23P01") ||
      text.includes("exclusion constraint")
    ) {
      throw new AppError(
        httpStatus.CONFLICT,
        "Technician already has a visit in this time slot",
      );
    }

    // unique_violation (23505 / P2002) => request already has an active assignment
    if (
      text.includes("one_active_assignment_per_request") ||
      (text.includes("P2002") && text.includes("serviceRequestId"))
    ) {
      throw new AppError(
        httpStatus.CONFLICT,
        "This service request already has an active assignment",
      );
    }

    throw error;
  }
};

const getTechnicianOrThrow = async (user: IRequestUser) => {
  const technician = await prisma.technician.findUnique({
    where: { userId: user.userId },
  });
  if (!technician) {
    throw new AppError(httpStatus.NOT_FOUND, "Technician Profile Not Found");
  }
  return technician;
};

const getAvailableTechnicians = async (query: IAvailableTechnicianQuery) => {
  if (!query.scheduledStart || !query.scheduledEnd) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "scheduledStart and scheduledEnd query params are required",
    );
  }

  const start = parseDate(query.scheduledStart, "scheduledStart");
  const end = parseDate(query.scheduledEnd, "scheduledEnd");

  if (end <= start) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "scheduledEnd must be after scheduledStart",
    );
  }

  return prisma.technician.findMany({
    where: {
      isDeleted: false,
      isAvailable: true,
      verificationStatus: "APPROVED",
      user: { status: "ACTIVE", isDeleted: false },
      ...(query.skillId
        ? { skills: { some: { skillId: query.skillId } } }
        : {}),

      assignments: {
        none: {
          status: { in: ACTIVE_STATUSES },
          scheduledStart: { lt: end },
          scheduledEnd: { gt: start },
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      contactNumber: true,
      experienceYears: true,
      bio: true,
      user: { select: { imageUrl: true } },
      skills: {
        select: {
          level: true,
          skill: { select: { id: true, name: true, category: true } },
        },
      },
    },
    orderBy: { experienceYears: "desc" },
  });
};

const createAssignment = async (
  payload: ICreateAssignmentPayload,
  user: IRequestUser,
) => {
  const { serviceRequestId, technicianId, scheduledStart, scheduledEnd } =
    payload;

  validateVisitWindow(scheduledStart, scheduledEnd);

  const created = await withConstraintErrors(() =>
    prisma.$transaction(async (tx) => {
      const serviceRequest = await tx.serviceRequest.findFirst({
        where: { id: serviceRequestId, isDeleted: false },
      });

      if (!serviceRequest) {
        throw new AppError(httpStatus.NOT_FOUND, "Service Request Not Found");
      }
      if (serviceRequest.status !== "APPROVED") {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `Only APPROVED requests can be assigned. Current status: ${serviceRequest.status}`,
        );
      }

      const activeAssignment = await tx.assignment.findFirst({
        where: { serviceRequestId, status: { in: ACTIVE_STATUSES } },
        select: { id: true },
      });
      if (activeAssignment) {
        throw new AppError(
          httpStatus.CONFLICT,
          "This request already has an active assignment. Use reschedule or cancel it first.",
        );
      }

      await ensureTechnicianEligible(tx, technicianId);
      await ensureNoConflict(tx, technicianId, scheduledStart, scheduledEnd);

      const assignment = await tx.assignment.create({
        data: {
          serviceRequestId,
          technicianId,
          scheduledStart,
          scheduledEnd,
          notes: payload.notes,
          status: "PENDING",
        },
        include: assignmentInclude,
      });

      await AuditLogServices.record(
        {
          action: "ASSIGNMENT_CREATED",
          entityType: "Assignment",
          entityId: assignment.id,
          description: "Technician assigned to service request",
          actor: user,
          newValue: {
            status: "PENDING",
            technicianId,
            serviceRequestId,
            scheduledStart: scheduledStart.toISOString(),
            scheduledEnd: scheduledEnd.toISOString(),
          },
        },
        tx,
      );

      return assignment;
    }),
  );

  void NotificationEvents.assignmentCreated(created.id);

  return created;
};

const confirmAssignment = async (assignmentId: string, user: IRequestUser) => {
  const technician = await getTechnicianOrThrow(user);

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
  });

  if (!assignment) {
    throw new AppError(httpStatus.NOT_FOUND, "Assignment Not Found");
  }
  if (assignment.technicianId !== technician.id) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not allowed to confirm this assignment",
    );
  }
  if (assignment.status !== "PENDING") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Only PENDING assignments can be confirmed. Current status: ${assignment.status}`,
    );
  }
  if (assignment.scheduledEnd <= new Date()) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This visit time has already passed. Ask the admin to reschedule.",
    );
  }

  const confirmed = await prisma.$transaction(async (tx) => {
    const updated = await tx.assignment.updateMany({
      where: { id: assignmentId, status: "PENDING" },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
    });

    if (updated.count === 0) {
      throw new AppError(
        httpStatus.CONFLICT,
        "Assignment was changed by someone else. Please refresh.",
      );
    }

    const workOrder = await tx.workOrder.create({
      data: { assignmentId, status: "SCHEDULED" },
    });

    await AuditLogServices.record(
      {
        action: "ASSIGNMENT_CONFIRMED",
        entityType: "Assignment",
        entityId: assignmentId,
        description: "Technician confirmed the assignment",
        actor: user,
        oldValue: { status: "PENDING" },
        newValue: { status: "CONFIRMED" },
        metadata: { workOrderId: workOrder.id },
      },
      tx,
    );

    return tx.assignment.findUniqueOrThrow({
      where: { id: assignmentId },
      include: assignmentInclude,
    });
  });

  void NotificationEvents.assignmentConfirmed(assignmentId);

  return confirmed;
};

const cancelAssignment = async (
  assignmentId: string,
  payload: ICancelAssignmentPayload,
  user: IRequestUser,
) => {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { workOrder: { select: { id: true, status: true } } },
  });

  if (!assignment) {
    throw new AppError(httpStatus.NOT_FOUND, "Assignment Not Found");
  }

  if (user.role === "TECHNICIAN") {
    const technician = await getTechnicianOrThrow(user);
    if (assignment.technicianId !== technician.id) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You are not allowed to cancel this assignment",
      );
    }
  }

  if (!ACTIVE_STATUSES.includes(assignment.status)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot cancel an assignment with status: ${assignment.status}`,
    );
  }
  if (assignment.workOrder && assignment.workOrder.status !== "SCHEDULED") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Work has already started (${assignment.workOrder.status}). Cannot cancel.`,
    );
  }

  const cancelled = await prisma.$transaction(async (tx) => {
    const updated = await tx.assignment.updateMany({
      where: { id: assignmentId, status: { in: ACTIVE_STATUSES } },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: payload.reason,
        cancelledBy: user.userId,
      },
    });

    if (updated.count === 0) {
      throw new AppError(
        httpStatus.CONFLICT,
        "Assignment was changed by someone else. Please refresh.",
      );
    }

    if (assignment.workOrder) {
      await tx.workOrder.update({
        where: { id: assignment.workOrder.id },
        data: { status: "CANCELLED" },
      });
    }

    await AuditLogServices.record(
      {
        action: "ASSIGNMENT_CANCELLED",
        entityType: "Assignment",
        entityId: assignmentId,
        description: `Assignment cancelled by ${user.role.toLowerCase()}`,
        actor: user,
        oldValue: { status: assignment.status },
        newValue: { status: "CANCELLED", reason: payload.reason },
        metadata: assignment.workOrder
          ? { workOrderId: assignment.workOrder.id }
          : undefined,
      },
      tx,
    );

    return tx.assignment.findUniqueOrThrow({
      where: { id: assignmentId },
      include: assignmentInclude,
    });
  });

  void NotificationEvents.assignmentCancelled(assignmentId);

  return cancelled;
};

const rescheduleAssignment = async (
  assignmentId: string,
  payload: IRescheduleAssignmentPayload,
  user: IRequestUser,
) => {
  const { scheduledStart, scheduledEnd } = payload;
  validateVisitWindow(scheduledStart, scheduledEnd);

  const created = await withConstraintErrors(() =>
    prisma.$transaction(async (tx) => {
      const current = await tx.assignment.findUnique({
        where: { id: assignmentId },
        include: { workOrder: { select: { id: true, status: true } } },
      });

      if (!current) {
        throw new AppError(httpStatus.NOT_FOUND, "Assignment Not Found");
      }
      if (!ACTIVE_STATUSES.includes(current.status)) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `Only PENDING or CONFIRMED assignments can be rescheduled. Current status: ${current.status}`,
        );
      }
      if (current.workOrder && current.workOrder.status !== "SCHEDULED") {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `Work has already started (${current.workOrder.status}). Cannot reschedule.`,
        );
      }

      const newTechnicianId = payload.technicianId ?? current.technicianId;

      const closed = await tx.assignment.updateMany({
        where: { id: assignmentId, status: { in: ACTIVE_STATUSES } },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelReason: payload.reason ?? "Rescheduled by admin",
          cancelledBy: user.userId,
        },
      });
      if (closed.count === 0) {
        throw new AppError(
          httpStatus.CONFLICT,
          "Assignment was changed by someone else. Please refresh.",
        );
      }

      if (current.workOrder) {
        await tx.workOrder.update({
          where: { id: current.workOrder.id },
          data: { status: "CANCELLED" },
        });
      }

      // 2) validate the new slot
      await ensureTechnicianEligible(tx, newTechnicianId);
      await ensureNoConflict(tx, newTechnicianId, scheduledStart, scheduledEnd);

      // 3) create the new assignment
      const next = await tx.assignment.create({
        data: {
          serviceRequestId: current.serviceRequestId,
          technicianId: newTechnicianId,
          scheduledStart,
          scheduledEnd,
          notes: payload.notes ?? current.notes,
          status: "PENDING",
        },
        include: assignmentInclude,
      });

      await AuditLogServices.record(
        {
          action: "ASSIGNMENT_RESCHEDULED",
          entityType: "Assignment",
          entityId: assignmentId,
          description: "Assignment rescheduled by admin",
          actor: user,
          oldValue: {
            technicianId: current.technicianId,
            scheduledStart: current.scheduledStart.toISOString(),
            scheduledEnd: current.scheduledEnd.toISOString(),
          },
          newValue: {
            technicianId: newTechnicianId,
            scheduledStart: scheduledStart.toISOString(),
            scheduledEnd: scheduledEnd.toISOString(),
          },
          metadata: {
            newAssignmentId: next.id,
            reason: payload.reason ?? null,
          },
        },
        tx,
      );

      return next;
    }),
  );

  void NotificationEvents.assignmentRescheduled(assignmentId, created.id);

  return created;
};

const getAllAssignments = async (query: IAssignmentQuery) => {
  const { page, limit, skip, sortBy, sortOrder } = parsePagination(query);
  const where: Prisma.AssignmentWhereInput = { AND: buildListFilters(query) };

  const [data, total] = await Promise.all([
    prisma.assignment.findMany({
      where,
      take: limit,
      skip,
      orderBy: { [sortBy]: sortOrder },
      include: assignmentInclude,
    }),
    prisma.assignment.count({ where }),
  ]);

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

const getMyAssignments = async (
  query: IAssignmentQuery,
  user: IRequestUser,
) => {
  const technician = await getTechnicianOrThrow(user);
  const { page, limit, skip, sortBy, sortOrder } = parsePagination({
    ...query,
    sortOrder: query.sortOrder ?? "asc",
  });

  const where: Prisma.AssignmentWhereInput = {
    AND: [
      { technicianId: technician.id },
      ...buildListFilters({ ...query, technicianId: undefined }),
    ],
  };

  const [data, total] = await Promise.all([
    prisma.assignment.findMany({
      where,
      take: limit,
      skip,
      orderBy: { [sortBy]: sortOrder },
      include: assignmentInclude,
    }),
    prisma.assignment.count({ where }),
  ]);

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

const getSingleAssignment = async (
  assignmentId: string,
  user: IRequestUser,
) => {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: assignmentInclude,
  });

  if (!assignment) {
    throw new AppError(httpStatus.NOT_FOUND, "Assignment Not Found");
  }

  if (user.role === "TECHNICIAN") {
    const technician = await getTechnicianOrThrow(user);
    if (assignment.technicianId !== technician.id) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You are not allowed to view this assignment",
      );
    }
  }

  return assignment;
};

export const AssignmentServices = {
  getAvailableTechnicians,
  createAssignment,
  confirmAssignment,
  cancelAssignment,
  rescheduleAssignment,
  getAllAssignments,
  getMyAssignments,
  getSingleAssignment,
};
