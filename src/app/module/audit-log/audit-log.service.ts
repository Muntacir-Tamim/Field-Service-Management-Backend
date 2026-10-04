import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import { AuditAction, Role } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { IAuditLogInput, IAuditLogQuery } from "./audit-log.interface";

const SORTABLE_FIELDS = ["createdAt", "action", "entityType"];

const auditLogInclude = {
  actor: {
    select: { id: true, name: true, email: true, role: true },
  },
} satisfies Prisma.AuditLogInclude;

/**
 * Write one audit log row.
 *
 * - With `tx`   : runs inside the caller's transaction. The log and the
 *                 change are saved together (or rolled back together).
 * - Without `tx`: best effort. A logging failure is printed but never
 *                 breaks the real request.
 */
const record = async (input: IAuditLogInput, tx?: Prisma.TransactionClient) => {
  const data: Prisma.AuditLogUncheckedCreateInput = {
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    description: input.description,
    oldValue: input.oldValue,
    newValue: input.newValue,
    metadata: input.metadata,
    actorId: input.actor?.userId ?? null,
    actorRole: input.actor?.role ?? null,
  };

  if (tx) {
    return tx.auditLog.create({ data });
  }

  try {
    return await prisma.auditLog.create({ data });
  } catch (error) {
    console.error("Failed to write audit log:", error);
    return null;
  }
};

const parseDate = (value: string, label: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(httpStatus.BAD_REQUEST, `Invalid "${label}" date`);
  }
  return date;
};

const getAllAuditLogs = async (query: IAuditLogQuery) => {
  const page = Math.max(Number.parseInt(query.page ?? "1", 10) || 1, 1);
  const limit = Math.min(
    Math.max(Number.parseInt(query.limit ?? "20", 10) || 20, 1),
    100,
  );
  const sortBy = SORTABLE_FIELDS.includes(query.sortBy ?? "")
    ? (query.sortBy as string)
    : "createdAt";
  const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";

  const where: Prisma.AuditLogWhereInput = {};

  if (query.action) {
    if (!(Object.values(AuditAction) as string[]).includes(query.action)) {
      throw new AppError(httpStatus.BAD_REQUEST, "Invalid audit action");
    }
    where.action = query.action as AuditAction;
  }

  if (query.actorRole) {
    if (!(Object.values(Role) as string[]).includes(query.actorRole)) {
      throw new AppError(httpStatus.BAD_REQUEST, "Invalid actor role");
    }
    where.actorRole = query.actorRole as Role;
  }

  if (query.entityType) {
    where.entityType = { equals: query.entityType, mode: "insensitive" };
  }
  if (query.entityId) where.entityId = query.entityId;
  if (query.actorId) where.actorId = query.actorId;

  if (query.from || query.to) {
    where.createdAt = {
      ...(query.from ? { gte: parseDate(query.from, "from") } : {}),
      ...(query.to ? { lte: parseDate(query.to, "to") } : {}),
    };
  }

  if (query.searchTerm) {
    where.OR = [
      { description: { contains: query.searchTerm, mode: "insensitive" } },
      { entityId: query.searchTerm },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: auditLogInclude,
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { [sortBy]: sortOrder },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

const getSingleAuditLog = async (auditLogId: string) => {
  const log = await prisma.auditLog.findUnique({
    where: { id: auditLogId },
    include: auditLogInclude,
  });

  if (!log) {
    throw new AppError(httpStatus.NOT_FOUND, "Audit Log Not Found");
  }

  return log;
};

export const AuditLogServices = {
  record,
  getAllAuditLogs,
  getSingleAuditLog,
};
s;
