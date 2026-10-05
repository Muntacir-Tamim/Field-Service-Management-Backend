import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { AuditLogController } from "./audio-log.controller";

const router = Router();

const MANAGEMENT = [Role.MANAGER] as const;

router.get("/", auth(...MANAGEMENT), AuditLogController.getAllAuditLogs);

router.get(
  "/:auditLogId",
  auth(...MANAGEMENT),
  AuditLogController.getSingleAuditLog,
);

export const AuditLogRoutes = router;
