import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { AnalyticsController } from "./analytics.controller";

const router = Router();

const MANAGEMENT = [Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN] as const;

// ── MANAGER / ADMIN ──────────────────────────────────
// GET /api/v1/analytics/dashboard?from=2026-10-01&to=2026-10-31
router.get(
  "/dashboard",
  auth(...MANAGEMENT),
  AnalyticsController.getDashboardStats,
);

// GET /api/v1/analytics/technicians?sortBy=averageRating&limit=10
router.get(
  "/technicians",
  auth(...MANAGEMENT),
  AnalyticsController.getTechnicianLeaderboard,
);

// ── TECHNICIAN ───────────────────────────────────────
// GET /api/v1/analytics/technicians/me   (must stay above /:technicianId)
router.get(
  "/technicians/me",
  auth(Role.TECHNICIAN),
  AnalyticsController.getMyStats,
);

// ── MANAGER / ADMIN ──────────────────────────────────
// GET /api/v1/analytics/technicians/:technicianId
router.get(
  "/technicians/:technicianId",
  auth(...MANAGEMENT),
  AnalyticsController.getSingleTechnicianStats,
);

export const AnalyticsRoutes = router;
