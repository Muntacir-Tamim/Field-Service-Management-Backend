import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { AnalyticsController } from "./analytics.controller";

const router = Router();

const MANAGEMENT = [Role.MANAGER] as const;

router.get(
  "/dashboard",
  auth(...MANAGEMENT),
  AnalyticsController.getDashboardStats,
);

router.get(
  "/technicians",
  auth(...MANAGEMENT),
  AnalyticsController.getTechnicianLeaderboard,
);

router.get(
  "/technicians/me",
  auth(Role.TECHNICIAN),
  AnalyticsController.getMyStats,
);

router.get(
  "/technicians/:technicianId",
  auth(...MANAGEMENT),
  AnalyticsController.getSingleTechnicianStats,
);

export const AnalyticsRoutes = router;
