import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { IRequestUser } from "../auth/auth.interface";
import { AuditLogServices } from "../audit-log/audit-log.service";
import type {
  IGetUsersQuery,
  IUpdateUserStatusPayload,
} from "./admin-user.interface";

// password / googleId kokhono response-e jabe na
const userListSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  emailVerified: true,
  authProvider: true,
  imageUrl: true,
  isDeleted: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { id: true, contactNumber: true, city: true } },
  technician: {
    select: {
      id: true,
      contactNumber: true,
      verificationStatus: true,
      isAvailable: true,
    },
  },
} satisfies Prisma.UserSelect;

const getAllUsers = async (query: IGetUsersQuery) => {
  const { page, limit, searchTerm, role, status, sortBy, sortOrder } = query;

  const and: Prisma.UserWhereInput[] = [
    // status=DELETED dile shudhu soft-deleted user, nahole deleted user dekhabe na
    { isDeleted: status === "DELETED" },
  ];

  if (role) and.push({ role });
  if (status) and.push({ status });

  if (searchTerm) {
    and.push({
      OR: [
        { name: { contains: searchTerm, mode: "insensitive" } },
        { email: { contains: searchTerm, mode: "insensitive" } },
        {
          customer: {
            is: {
              contactNumber: { contains: searchTerm, mode: "insensitive" },
            },
          },
        },
        {
          technician: {
            is: {
              contactNumber: { contains: searchTerm, mode: "insensitive" },
            },
          },
        },
      ],
    });
  }

  const where: Prisma.UserWhereInput = { AND: and };

  const [data, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: userListSelect,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// Block / Unblock
const updateUserStatus = async (
  targetUserId: string,
  payload: IUpdateUserStatusPayload,
  actor: IRequestUser,
) => {
  if (targetUserId === actor.userId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "You cannot change your own account status",
    );
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      isDeleted: true,
    },
  });

  if (!target || target.isDeleted || target.status === "DELETED") {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (target.role === "ADMIN") {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Admin account cannot be modified",
    );
  }

  if (target.status === payload.status) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `User is already ${payload.status.toLowerCase()}`,
    );
  }

  const isBlocking = payload.status === "BLOCKED";

  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: targetUserId },
      data: { status: payload.status },
      select: userListSelect,
    });

    // blocked technician jeno new assignment na pay
    if (isBlocking && target.role === "TECHNICIAN") {
      await tx.technician.updateMany({
        where: { userId: targetUserId },
        data: { isAvailable: false },
      });
    }

    await AuditLogServices.record(
      {
        action: isBlocking ? "USER_BLOCKED" : "USER_UNBLOCKED",
        entityType: "User",
        entityId: targetUserId,
        description: `${target.role} "${target.email}" ${
          isBlocking ? "blocked" : "unblocked"
        } by admin`,
        actor,
        oldValue: { status: target.status },
        newValue: { status: payload.status },
        metadata: { reason: payload.reason ?? null, targetRole: target.role },
      },
      tx,
    );

    return updated;
  });
};

// Soft delete
const deleteUser = async (targetUserId: string, actor: IRequestUser) => {
  if (targetUserId === actor.userId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "You cannot delete your own account",
    );
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      isDeleted: true,
      customer: { select: { id: true } },
      technician: { select: { id: true } },
    },
  });

  if (!target || target.isDeleted || target.status === "DELETED") {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (target.role === "ADMIN") {
    throw new AppError(httpStatus.FORBIDDEN, "Admin account cannot be deleted");
  }

  // Cholte thaka kaj thakle delete kora jabe na
  if (target.technician) {
    const activeJobs = await prisma.assignment.count({
      where: {
        technicianId: target.technician.id,
        status: { in: ["PENDING", "CONFIRMED"] },
        OR: [
          { workOrder: { is: null } },
          {
            workOrder: {
              status: { notIn: ["COMPLETED", "VERIFIED", "CANCELLED"] },
            },
          },
        ],
      },
    });
    if (activeJobs > 0) {
      throw new AppError(
        httpStatus.CONFLICT,
        `Technician has ${activeJobs} active assignment(s). Cancel or complete them first`,
      );
    }
  }

  if (target.customer) {
    const activeRequests = await prisma.serviceRequest.count({
      where: {
        customerId: target.customer.id,
        isDeleted: false,
        status: { in: ["PENDING", "UNDER_REVIEW", "APPROVED"] },
      },
    });
    if (activeRequests > 0) {
      throw new AppError(
        httpStatus.CONFLICT,
        `Customer has ${activeRequests} active service request(s). Cancel or complete them first`,
      );
    }
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: targetUserId },
      data: { isDeleted: true, deletedAt: now, status: "DELETED" },
    });

    if (target.customer) {
      await tx.customer.update({
        where: { id: target.customer.id },
        data: { isDeleted: true, deletedAt: now },
      });
    }

    if (target.technician) {
      await tx.technician.update({
        where: { id: target.technician.id },
        data: { isDeleted: true, deletedAt: now, isAvailable: false },
      });
    }

    await AuditLogServices.record(
      {
        action: "USER_DELETED",
        entityType: "User",
        entityId: targetUserId,
        description: `${target.role} "${target.email}" soft deleted by admin`,
        actor,
        oldValue: { status: target.status, isDeleted: false },
        newValue: { status: "DELETED", isDeleted: true },
        metadata: { targetRole: target.role },
      },
      tx,
    );
  });

  return { id: targetUserId, deletedAt: now };
};

export const AdminUserServices = {
  getAllUsers,
  updateUserStatus,
  deleteUser,
};
