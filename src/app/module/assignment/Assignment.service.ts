// import httpStatus from "http-status";
// import { Prisma } from "../../../generated/prisma/client";
// import type { AssignmentStatus } from "../../../generated/prisma/enums";
// import { prisma } from "../../lib/prisma";
// import { AppError } from "../../utils/AppError";
// import { NotificationEvents } from "../notification/notification.events";
// import {
//   IAssignmentQuery,
//   IAvailableTechnicianQuery,
//   ICancelAssignmentPayload,
//   ICreateAssignmentPayload,
//   IRescheduleAssignmentPayload,
// } from "./Assignment.interface";
// import { IRequestUser } from "../auth/auth.interface";

// type Tx = Prisma.TransactionClient;

// // A technician's time is "blocked" by these statuses only.
// const ACTIVE_STATUSES: AssignmentStatus[] = ["PENDING", "CONFIRMED"];
// const ALL_STATUSES: AssignmentStatus[] = ["PENDING", "CONFIRMED", "CANCELLED"];
// const MAX_VISIT_HOURS = 12;
// const SORTABLE_FIELDS = ["createdAt", "scheduledStart", "status"];

// // ─────────────────────────────────────────────
// // Reusable include (what the API returns)
// // ─────────────────────────────────────────────
// const assignmentInclude = {
//   serviceRequest: {
//     select: {
//       id: true,
//       title: true,
//       description: true,
//       priority: true,
//       status: true,
//       address: true,
//       city: true,
//       preferredDate: true,
//       customer: {
//         select: { id: true, name: true, contactNumber: true },
//       },
//     },
//   },
//   technician: {
//     select: {
//       id: true,
//       name: true,
//       email: true,
//       contactNumber: true,
//       user: { select: { imageUrl: true } },
//     },
//   },
//   workOrder: { select: { id: true, status: true } },
// } satisfies Prisma.AssignmentInclude;

// // ─────────────────────────────────────────────
// // Helpers
// // ─────────────────────────────────────────────
// const parseDate = (value: string, label: string) => {
//   const date = new Date(value);
//   if (Number.isNaN(date.getTime())) {
//     throw new AppError(httpStatus.BAD_REQUEST, `${label} is not a valid date`);
//   }
//   return date;
// };

// const parsePagination = (query: IAssignmentQuery) => {
//   const page = Math.max(Number.parseInt(query.page ?? "1", 10) || 1, 1);
//   const limit = Math.min(
//     Math.max(Number.parseInt(query.limit ?? "10", 10) || 10, 1),
//     100,
//   );
//   const sortBy = SORTABLE_FIELDS.includes(query.sortBy ?? "")
//     ? (query.sortBy as string)
//     : "scheduledStart";
//   const sortOrder: "asc" | "desc" = query.sortOrder === "asc" ? "asc" : "desc";
//   return { page, limit, skip: (page - 1) * limit, sortBy, sortOrder };
// };

// const buildListFilters = (query: IAssignmentQuery) => {
//   const and: Prisma.AssignmentWhereInput[] = [];

//   if (query.status) {
//     if (!ALL_STATUSES.includes(query.status as AssignmentStatus)) {
//       throw new AppError(
//         httpStatus.BAD_REQUEST,
//         `Invalid status. Use one of: ${ALL_STATUSES.join(", ")}`,
//       );
//     }
//     and.push({ status: query.status as AssignmentStatus });
//   }
//   if (query.technicianId) and.push({ technicianId: query.technicianId });
//   if (query.serviceRequestId) {
//     and.push({ serviceRequestId: query.serviceRequestId });
//   }
//   if (query.from) {
//     and.push({ scheduledStart: { gte: parseDate(query.from, "from") } });
//   }
//   if (query.to) {
//     and.push({ scheduledStart: { lte: parseDate(query.to, "to") } });
//   }
//   return and;
// };

// const validateVisitWindow = (start: Date, end: Date) => {
//   if (end <= start) {
//     throw new AppError(
//       httpStatus.BAD_REQUEST,
//       "scheduledEnd must be after scheduledStart",
//     );
//   }
//   if (start <= new Date()) {
//     throw new AppError(
//       httpStatus.BAD_REQUEST,
//       "scheduledStart must be in the future",
//     );
//   }
//   const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
//   if (hours > MAX_VISIT_HOURS) {
//     throw new AppError(
//       httpStatus.BAD_REQUEST,
//       `A visit cannot be longer than ${MAX_VISIT_HOURS} hours`,
//     );
//   }
// };

// // Technician must be approved, available, not deleted and account active
// const ensureTechnicianEligible = async (tx: Tx, technicianId: string) => {
//   const technician = await tx.technician.findUnique({
//     where: { id: technicianId },
//     include: { user: { select: { status: true, isDeleted: true } } },
//   });

//   if (!technician || technician.isDeleted || technician.user.isDeleted) {
//     throw new AppError(httpStatus.NOT_FOUND, "Technician Not Found");
//   }
//   if (technician.verificationStatus !== "APPROVED") {
//     throw new AppError(
//       httpStatus.BAD_REQUEST,
//       "Technician is not verified yet",
//     );
//   }
//   if (technician.user.status !== "ACTIVE") {
//     throw new AppError(
//       httpStatus.BAD_REQUEST,
//       "Technician account is not active",
//     );
//   }
//   if (!technician.isAvailable) {
//     throw new AppError(
//       httpStatus.BAD_REQUEST,
//       "Technician is currently marked as unavailable",
//     );
//   }
//   return technician;
// };

// // Time overlap rule:  existing.start < newEnd  AND  existing.end > newStart
// // (so 10:00-12:00 and 12:00-14:00 do NOT conflict)
// const ensureNoConflict = async (
//   tx: Tx,
//   technicianId: string,
//   start: Date,
//   end: Date,
//   excludeAssignmentId?: string,
// ) => {
//   const conflict = await tx.assignment.findFirst({
//     where: {
//       technicianId,
//       status: { in: ACTIVE_STATUSES },
//       scheduledStart: { lt: end },
//       scheduledEnd: { gt: start },
//       ...(excludeAssignmentId ? { id: { not: excludeAssignmentId } } : {}),
//     },
//     select: { scheduledStart: true, scheduledEnd: true },
//   });

//   if (conflict) {
//     throw new AppError(
//       httpStatus.CONFLICT,
//       `Technician already has a visit from ${conflict.scheduledStart.toISOString()} to ${conflict.scheduledEnd.toISOString()}`,
//     );
//   }
// };

// // The DB constraints are the final safety net when two managers act at the same moment.
// const withConstraintErrors = async <T>(fn: () => Promise<T>): Promise<T> => {
//   try {
//     return await fn();
//   } catch (error) {
//     const e = error as { message?: string; code?: string; meta?: unknown };
//     const text = `${e?.message ?? ""} ${e?.code ?? ""} ${JSON.stringify(e?.meta ?? {})}`;

//     if (text.includes("no_technician_overlap") || text.includes("23P01")) {
//       throw new AppError(
//         httpStatus.CONFLICT,
//         "Technician already has a visit in this time slot",
//       );
//     }
//     if (text.includes("one_active_assignment_per_request")) {
//       throw new AppError(
//         httpStatus.CONFLICT,
//         "This service request already has an active assignment",
//       );
//     }
//     throw error;
//   }
// };

// const getTechnicianOrThrow = async (user: IRequestUser) => {
//   const technician = await prisma.technician.findUnique({
//     where: { userId: user.userId },
//   });
//   if (!technician) {
//     throw new AppError(httpStatus.NOT_FOUND, "Technician Profile Not Found");
//   }
//   return technician;
// };

// // ─────────────────────────────────────────────
// // MANAGER: available technicians for a time window
// // ─────────────────────────────────────────────
// const getAvailableTechnicians = async (query: IAvailableTechnicianQuery) => {
//   if (!query.scheduledStart || !query.scheduledEnd) {
//     throw new AppError(
//       httpStatus.BAD_REQUEST,
//       "scheduledStart and scheduledEnd query params are required",
//     );
//   }

//   const start = parseDate(query.scheduledStart, "scheduledStart");
//   const end = parseDate(query.scheduledEnd, "scheduledEnd");

//   if (end <= start) {
//     throw new AppError(
//       httpStatus.BAD_REQUEST,
//       "scheduledEnd must be after scheduledStart",
//     );
//   }

//   return prisma.technician.findMany({
//     where: {
//       isDeleted: false,
//       isAvailable: true,
//       verificationStatus: "APPROVED",
//       user: { status: "ACTIVE", isDeleted: false },
//       ...(query.skillId
//         ? { skills: { some: { skillId: query.skillId } } }
//         : {}),
//       // no PENDING/CONFIRMED assignment overlapping the window
//       assignments: {
//         none: {
//           status: { in: ACTIVE_STATUSES },
//           scheduledStart: { lt: end },
//           scheduledEnd: { gt: start },
//         },
//       },
//     },
//     select: {
//       id: true,
//       name: true,
//       email: true,
//       contactNumber: true,
//       experienceYears: true,
//       bio: true,
//       user: { select: { imageUrl: true } },
//       skills: {
//         select: {
//           level: true,
//           skill: { select: { id: true, name: true, category: true } },
//         },
//       },
//     },
//     orderBy: { experienceYears: "desc" },
//   });
// };

// // ─────────────────────────────────────────────
// // MANAGER: assign technician + schedule visit  (Step 4 + 5)
// // ─────────────────────────────────────────────
// const createAssignment = async (
//   payload: ICreateAssignmentPayload,
//   _user: IRequestUser,
// ) => {
//   const { serviceRequestId, technicianId, scheduledStart, scheduledEnd } =
//     payload;

//   validateVisitWindow(scheduledStart, scheduledEnd);

//   return withConstraintErrors(() =>
//     prisma.$transaction(async (tx) => {
//       const serviceRequest = await tx.serviceRequest.findFirst({
//         where: { id: serviceRequestId, isDeleted: false },
//       });

//       if (!serviceRequest) {
//         throw new AppError(httpStatus.NOT_FOUND, "Service Request Not Found");
//       }
//       if (serviceRequest.status !== "APPROVED") {
//         throw new AppError(
//           httpStatus.BAD_REQUEST,
//           `Only APPROVED requests can be assigned. Current status: ${serviceRequest.status}`,
//         );
//       }

//       const activeAssignment = await tx.assignment.findFirst({
//         where: { serviceRequestId, status: { in: ACTIVE_STATUSES } },
//         select: { id: true },
//       });
//       if (activeAssignment) {
//         throw new AppError(
//           httpStatus.CONFLICT,
//           "This request already has an active assignment. Use reschedule or cancel it first.",
//         );
//       }

//       await ensureTechnicianEligible(tx, technicianId);
//       await ensureNoConflict(tx, technicianId, scheduledStart, scheduledEnd);

//       return tx.assignment.create({
//         data: {
//           serviceRequestId,
//           technicianId,
//           scheduledStart,
//           scheduledEnd,
//           notes: payload.notes,
//           status: "PENDING",
//         },
//         include: assignmentInclude,
//       });
//     }),
//   );
// };

// // ─────────────────────────────────────────────
// // TECHNICIAN: confirm  → creates the WorkOrder
// // ─────────────────────────────────────────────
// const confirmAssignment = async (assignmentId: string, user: IRequestUser) => {
//   const technician = await getTechnicianOrThrow(user);

//   const assignment = await prisma.assignment.findUnique({
//     where: { id: assignmentId },
//   });

//   if (!assignment) {
//     throw new AppError(httpStatus.NOT_FOUND, "Assignment Not Found");
//   }
//   if (assignment.technicianId !== technician.id) {
//     throw new AppError(
//       httpStatus.FORBIDDEN,
//       "You are not allowed to confirm this assignment",
//     );
//   }
//   if (assignment.status !== "PENDING") {
//     throw new AppError(
//       httpStatus.BAD_REQUEST,
//       `Only PENDING assignments can be confirmed. Current status: ${assignment.status}`,
//     );
//   }
//   if (assignment.scheduledEnd <= new Date()) {
//     throw new AppError(
//       httpStatus.BAD_REQUEST,
//       "This visit time has already passed. Ask the manager to reschedule.",
//     );
//   }

//   return prisma.$transaction(async (tx) => {
//     // status condition inside the update => safe if called twice at once
//     const updated = await tx.assignment.updateMany({
//       where: { id: assignmentId, status: "PENDING" },
//       data: { status: "CONFIRMED", confirmedAt: new Date() },
//     });

//     if (updated.count === 0) {
//       throw new AppError(
//         httpStatus.CONFLICT,
//         "Assignment was changed by someone else. Please refresh.",
//       );
//     }

//     await tx.workOrder.create({
//       data: { assignmentId, status: "SCHEDULED" },
//     });

//     return tx.assignment.findUniqueOrThrow({
//       where: { id: assignmentId },
//       include: assignmentInclude,
//     });
//   });
// };

// // ─────────────────────────────────────────────
// // MANAGER or TECHNICIAN: cancel
// //   technician cancelling a PENDING assignment = decline
// // ─────────────────────────────────────────────
// const cancelAssignment = async (
//   assignmentId: string,
//   payload: ICancelAssignmentPayload,
//   user: IRequestUser,
// ) => {
//   const assignment = await prisma.assignment.findUnique({
//     where: { id: assignmentId },
//     include: { workOrder: { select: { id: true, status: true } } },
//   });

//   if (!assignment) {
//     throw new AppError(httpStatus.NOT_FOUND, "Assignment Not Found");
//   }

//   if (user.role === "TECHNICIAN") {
//     const technician = await getTechnicianOrThrow(user);
//     if (assignment.technicianId !== technician.id) {
//       throw new AppError(
//         httpStatus.FORBIDDEN,
//         "You are not allowed to cancel this assignment",
//       );
//     }
//   }

//   if (!ACTIVE_STATUSES.includes(assignment.status)) {
//     throw new AppError(
//       httpStatus.BAD_REQUEST,
//       `Cannot cancel an assignment with status: ${assignment.status}`,
//     );
//   }
//   if (assignment.workOrder && assignment.workOrder.status !== "SCHEDULED") {
//     throw new AppError(
//       httpStatus.BAD_REQUEST,
//       `Work has already started (${assignment.workOrder.status}). Cannot cancel.`,
//     );
//   }

//   return prisma.$transaction(async (tx) => {
//     const updated = await tx.assignment.updateMany({
//       where: { id: assignmentId, status: { in: ACTIVE_STATUSES } },
//       data: {
//         status: "CANCELLED",
//         cancelledAt: new Date(),
//         cancelReason: payload.reason,
//         cancelledBy: user.userId,
//       },
//     });

//     if (updated.count === 0) {
//       throw new AppError(
//         httpStatus.CONFLICT,
//         "Assignment was changed by someone else. Please refresh.",
//       );
//     }

//     if (assignment.workOrder) {
//       await tx.workOrder.update({
//         where: { id: assignment.workOrder.id },
//         data: { status: "CANCELLED" },
//       });
//     }

//     // ServiceRequest stays APPROVED so the manager can assign someone else.
//     return tx.assignment.findUniqueOrThrow({
//       where: { id: assignmentId },
//       include: assignmentInclude,
//     });
//   });
// };

// // ─────────────────────────────────────────────
// // MANAGER: reschedule
// //   old assignment -> CANCELLED (+ its WorkOrder CANCELLED)
// //   new assignment -> PENDING (technician must confirm again)
// // ─────────────────────────────────────────────
// const rescheduleAssignment = async (
//   assignmentId: string,
//   payload: IRescheduleAssignmentPayload,
//   user: IRequestUser,
// ) => {
//   const { scheduledStart, scheduledEnd } = payload;
//   validateVisitWindow(scheduledStart, scheduledEnd);

//   return withConstraintErrors(() =>
//     prisma.$transaction(async (tx) => {
//       const current = await tx.assignment.findUnique({
//         where: { id: assignmentId },
//         include: { workOrder: { select: { id: true, status: true } } },
//       });

//       if (!current) {
//         throw new AppError(httpStatus.NOT_FOUND, "Assignment Not Found");
//       }
//       if (!ACTIVE_STATUSES.includes(current.status)) {
//         throw new AppError(
//           httpStatus.BAD_REQUEST,
//           `Only PENDING or CONFIRMED assignments can be rescheduled. Current status: ${current.status}`,
//         );
//       }
//       if (current.workOrder && current.workOrder.status !== "SCHEDULED") {
//         throw new AppError(
//           httpStatus.BAD_REQUEST,
//           `Work has already started (${current.workOrder.status}). Cannot reschedule.`,
//         );
//       }

//       const newTechnicianId = payload.technicianId ?? current.technicianId;

//       // 1) close the old assignment first (frees its time slot)
//       const closed = await tx.assignment.updateMany({
//         where: { id: assignmentId, status: { in: ACTIVE_STATUSES } },
//         data: {
//           status: "CANCELLED",
//           cancelledAt: new Date(),
//           cancelReason: payload.reason ?? "Rescheduled by manager",
//           cancelledBy: user.userId,
//         },
//       });
//       if (closed.count === 0) {
//         throw new AppError(
//           httpStatus.CONFLICT,
//           "Assignment was changed by someone else. Please refresh.",
//         );
//       }

//       if (current.workOrder) {
//         await tx.workOrder.update({
//           where: { id: current.workOrder.id },
//           data: { status: "CANCELLED" },
//         });
//       }

//       // 2) validate the new slot
//       await ensureTechnicianEligible(tx, newTechnicianId);
//       await ensureNoConflict(tx, newTechnicianId, scheduledStart, scheduledEnd);

//       // 3) create the new assignment
//       return tx.assignment.create({
//         data: {
//           serviceRequestId: current.serviceRequestId,
//           technicianId: newTechnicianId,
//           scheduledStart,
//           scheduledEnd,
//           notes: payload.notes ?? current.notes,
//           status: "PENDING",
//         },
//         include: assignmentInclude,
//       });
//     }),
//   );
// };

// // ─────────────────────────────────────────────
// // MANAGER: list all assignments
// // ─────────────────────────────────────────────
// const getAllAssignments = async (query: IAssignmentQuery) => {
//   const { page, limit, skip, sortBy, sortOrder } = parsePagination(query);
//   const where: Prisma.AssignmentWhereInput = { AND: buildListFilters(query) };

//   const [data, total] = await Promise.all([
//     prisma.assignment.findMany({
//       where,
//       take: limit,
//       skip,
//       orderBy: { [sortBy]: sortOrder },
//       include: assignmentInclude,
//     }),
//     prisma.assignment.count({ where }),
//   ]);

//   return {
//     data,
//     meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
//   };
// };

// // ─────────────────────────────────────────────
// // TECHNICIAN: my schedule
// // ─────────────────────────────────────────────
// const getMyAssignments = async (
//   query: IAssignmentQuery,
//   user: IRequestUser,
// ) => {
//   const technician = await getTechnicianOrThrow(user);
//   const { page, limit, skip, sortBy, sortOrder } = parsePagination({
//     ...query,
//     sortOrder: query.sortOrder ?? "asc", // schedule reads best oldest → newest
//   });

//   // technicianId from query is ignored: a technician only sees own data
//   const where: Prisma.AssignmentWhereInput = {
//     AND: [
//       { technicianId: technician.id },
//       ...buildListFilters({ ...query, technicianId: undefined }),
//     ],
//   };

//   const [data, total] = await Promise.all([
//     prisma.assignment.findMany({
//       where,
//       take: limit,
//       skip,
//       orderBy: { [sortBy]: sortOrder },
//       include: assignmentInclude,
//     }),
//     prisma.assignment.count({ where }),
//   ]);

//   return {
//     data,
//     meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
//   };
// };

// // ─────────────────────────────────────────────
// // SINGLE
// // ─────────────────────────────────────────────
// const getSingleAssignment = async (
//   assignmentId: string,
//   user: IRequestUser,
// ) => {
//   const assignment = await prisma.assignment.findUnique({
//     where: { id: assignmentId },
//     include: assignmentInclude,
//   });

//   if (!assignment) {
//     throw new AppError(httpStatus.NOT_FOUND, "Assignment Not Found");
//   }

//   if (user.role === "TECHNICIAN") {
//     const technician = await getTechnicianOrThrow(user);
//     if (assignment.technicianId !== technician.id) {
//       throw new AppError(
//         httpStatus.FORBIDDEN,
//         "You are not allowed to view this assignment",
//       );
//     }
//   }

//   return assignment;
// };

// export const AssignmentServices = {
//   getAvailableTechnicians,
//   createAssignment,
//   confirmAssignment,
//   cancelAssignment,
//   rescheduleAssignment,
//   getAllAssignments,
//   getMyAssignments,
//   getSingleAssignment,
// };

import httpStatus from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import type { AssignmentStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { NotificationEvents } from "../notification/notification.events"; // 🔔 NOTIFICATION
import {
  IAssignmentQuery,
  IAvailableTechnicianQuery,
  ICancelAssignmentPayload,
  ICreateAssignmentPayload,
  IRescheduleAssignmentPayload,
} from "./Assignment.interface";
import { IRequestUser } from "../auth/auth.interface";

type Tx = Prisma.TransactionClient;

// A technician's time is "blocked" by these statuses only.
const ACTIVE_STATUSES: AssignmentStatus[] = ["PENDING", "CONFIRMED"];
const ALL_STATUSES: AssignmentStatus[] = ["PENDING", "CONFIRMED", "CANCELLED"];
const MAX_VISIT_HOURS = 12;
const SORTABLE_FIELDS = ["createdAt", "scheduledStart", "status"];

// ─────────────────────────────────────────────
// Reusable include (what the API returns)
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
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

// Technician must be approved, available, not deleted and account active
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

// Time overlap rule:  existing.start < newEnd  AND  existing.end > newStart
// (so 10:00-12:00 and 12:00-14:00 do NOT conflict)
const ensureNoConflict = async (
  tx: Tx,
  technicianId: string,
  start: Date,
  end: Date,
  excludeAssignmentId?: string,
) => {
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

// The DB constraints are the final safety net when two managers act at the same moment.
const withConstraintErrors = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    const e = error as { message?: string; code?: string; meta?: unknown };
    const text = `${e?.message ?? ""} ${e?.code ?? ""} ${JSON.stringify(e?.meta ?? {})}`;

    if (text.includes("no_technician_overlap") || text.includes("23P01")) {
      throw new AppError(
        httpStatus.CONFLICT,
        "Technician already has a visit in this time slot",
      );
    }
    if (text.includes("one_active_assignment_per_request")) {
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

// ─────────────────────────────────────────────
// MANAGER: available technicians for a time window
// ─────────────────────────────────────────────
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
      // no PENDING/CONFIRMED assignment overlapping the window
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

// ─────────────────────────────────────────────
// MANAGER: assign technician + schedule visit  (Step 4 + 5)
// ─────────────────────────────────────────────
const createAssignment = async (
  payload: ICreateAssignmentPayload,
  _user: IRequestUser,
) => {
  const { serviceRequestId, technicianId, scheduledStart, scheduledEnd } =
    payload;

  validateVisitWindow(scheduledStart, scheduledEnd);

  const created = await withConstraintErrors(() =>
    // 🔔 NOTIFICATION: "return" bodle "const created ="
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

      return tx.assignment.create({
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
    }),
  );

  // 🔔 NOTIFICATION: technician-ke notun job er khobor
  void NotificationEvents.assignmentCreated(created.id);

  return created;
};

// ─────────────────────────────────────────────
// TECHNICIAN: confirm  → creates the WorkOrder
// ─────────────────────────────────────────────
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
      "This visit time has already passed. Ask the manager to reschedule.",
    );
  }

  const confirmed = await prisma.$transaction(async (tx) => {
    // 🔔 NOTIFICATION: "return" bodle "const confirmed ="
    // status condition inside the update => safe if called twice at once
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

    await tx.workOrder.create({
      data: { assignmentId, status: "SCHEDULED" },
    });

    return tx.assignment.findUniqueOrThrow({
      where: { id: assignmentId },
      include: assignmentInclude,
    });
  });

  // 🔔 NOTIFICATION: customer + managers-ke visit confirm er khobor
  void NotificationEvents.assignmentConfirmed(assignmentId);

  return confirmed;
};

// ─────────────────────────────────────────────
// MANAGER or TECHNICIAN: cancel
//   technician cancelling a PENDING assignment = decline
// ─────────────────────────────────────────────
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
    // 🔔 NOTIFICATION: "return" bodle "const cancelled ="
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

    // ServiceRequest stays APPROVED so the manager can assign someone else.
    return tx.assignment.findUniqueOrThrow({
      where: { id: assignmentId },
      include: assignmentInclude,
    });
  });

  // 🔔 NOTIFICATION: decline hole managers-ke, manager cancel korle technician-ke
  void NotificationEvents.assignmentCancelled(assignmentId);

  return cancelled;
};

// ─────────────────────────────────────────────
// MANAGER: reschedule
//   old assignment -> CANCELLED (+ its WorkOrder CANCELLED)
//   new assignment -> PENDING (technician must confirm again)
// ─────────────────────────────────────────────
const rescheduleAssignment = async (
  assignmentId: string,
  payload: IRescheduleAssignmentPayload,
  user: IRequestUser,
) => {
  const { scheduledStart, scheduledEnd } = payload;
  validateVisitWindow(scheduledStart, scheduledEnd);

  const created = await withConstraintErrors(() =>
    // 🔔 NOTIFICATION: "return" bodle "const created ="
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

      // 1) close the old assignment first (frees its time slot)
      const closed = await tx.assignment.updateMany({
        where: { id: assignmentId, status: { in: ACTIVE_STATUSES } },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelReason: payload.reason ?? "Rescheduled by manager",
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
      return tx.assignment.create({
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
    }),
  );

  // 🔔 NOTIFICATION: assignmentId = purono (CANCELLED), created.id = notun (PENDING)
  void NotificationEvents.assignmentRescheduled(assignmentId, created.id);

  return created;
};

// ─────────────────────────────────────────────
// MANAGER: list all assignments
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// TECHNICIAN: my schedule
// ─────────────────────────────────────────────
const getMyAssignments = async (
  query: IAssignmentQuery,
  user: IRequestUser,
) => {
  const technician = await getTechnicianOrThrow(user);
  const { page, limit, skip, sortBy, sortOrder } = parsePagination({
    ...query,
    sortOrder: query.sortOrder ?? "asc", // schedule reads best oldest → newest
  });

  // technicianId from query is ignored: a technician only sees own data
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

// ─────────────────────────────────────────────
// SINGLE
// ─────────────────────────────────────────────
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
