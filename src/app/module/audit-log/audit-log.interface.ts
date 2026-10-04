import type { Prisma } from "../../../generated/prisma/client";
import type { AuditAction } from "../../../generated/prisma/enums";
import type { IRequestUser } from "../auth/auth.interface";

export interface IAuditLogInput {
  action: AuditAction;
  entityType: string;
  entityId: string;
  description: string;
  // null / undefined => system action (e.g. payment gateway callback)
  actor?: IRequestUser | null;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
}

export interface IAuditLogQuery {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  actorRole?: string;
  from?: string;
  to?: string;
  searchTerm?: string;
}
