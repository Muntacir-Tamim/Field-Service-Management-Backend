import { AsyncLocalStorage } from "node:async_hooks";
import type { NextFunction, Request, Response } from "express";

type AuditActor = { userId: string; email: string; role: string };
type AuditStore = { actor?: AuditActor; ip?: string };

const storage = new AsyncLocalStorage<AuditStore>();

export const auditContextMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  storage.run({ ip: req.ip }, next);
};

export const setAuditActor = (actor: AuditActor) => {
  const store = storage.getStore();
  if (store) store.actor = actor;
};

export const getAuditStore = () => storage.getStore();
