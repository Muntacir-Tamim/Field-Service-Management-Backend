import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AssignmentController } from "./Assignment.controller";
import {
  CancelAssignmentZodSchema,
  CreateAssignmentZodSchema,
  RescheduleAssignmentZodSchema,
} from "./Assignment.validation";

const router = Router();

const MANAGEMENT = [Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN] as const;

// ── TECHNICIAN ROUTES (static paths first, before "/:assignmentId") ──

// GET /api/v1/assignments/my-assignments?status=&from=&to=
router.get(
  "/my-assignments",
  auth(Role.TECHNICIAN),
  AssignmentController.getMyAssignments,
);

// ── MANAGER ROUTES ───────────────────────────────────

// GET /api/v1/assignments/available-technicians?scheduledStart=&scheduledEnd=&skillId=
router.get(
  "/available-technicians",
  auth(...MANAGEMENT),
  AssignmentController.getAvailableTechnicians,
);

// POST /api/v1/assignments   (Step 4: assign technician + Step 5: schedule visit)
router.post(
  "/",
  auth(...MANAGEMENT),
  validateRequest(CreateAssignmentZodSchema),
  AssignmentController.createAssignment,
);

// GET /api/v1/assignments
router.get("/", auth(...MANAGEMENT), AssignmentController.getAllAssignments);

// PATCH /api/v1/assignments/:assignmentId/reschedule
router.patch(
  "/:assignmentId/reschedule",
  auth(...MANAGEMENT),
  validateRequest(RescheduleAssignmentZodSchema),
  AssignmentController.rescheduleAssignment,
);

// ── TECHNICIAN: confirm ──────────────────────────────

// PATCH /api/v1/assignments/:assignmentId/confirm   (creates the WorkOrder)
router.patch(
  "/:assignmentId/confirm",
  auth(Role.TECHNICIAN),
  AssignmentController.confirmAssignment,
);

// ── MANAGER or TECHNICIAN: cancel ────────────────────

// PATCH /api/v1/assignments/:assignmentId/cancel
router.patch(
  "/:assignmentId/cancel",
  auth(Role.TECHNICIAN, ...MANAGEMENT),
  validateRequest(CancelAssignmentZodSchema),
  AssignmentController.cancelAssignment,
);

// ── SHARED ───────────────────────────────────────────

// GET /api/v1/assignments/:assignmentId
router.get(
  "/:assignmentId",
  auth(Role.TECHNICIAN, ...MANAGEMENT),
  AssignmentController.getSingleAssignment,
);

export const AssignmentRoutes = router;
