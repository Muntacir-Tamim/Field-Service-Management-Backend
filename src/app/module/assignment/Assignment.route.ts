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

router.get(
  "/my-assignments",
  auth(Role.TECHNICIAN),
  AssignmentController.getMyAssignments,
);

router.get(
  "/available-technicians",
  auth(...MANAGEMENT),
  AssignmentController.getAvailableTechnicians,
);

router.post(
  "/",
  auth(...MANAGEMENT),
  validateRequest(CreateAssignmentZodSchema),
  AssignmentController.createAssignment,
);

router.get("/", auth(...MANAGEMENT), AssignmentController.getAllAssignments);

router.patch(
  "/:assignmentId/reschedule",
  auth(...MANAGEMENT),
  validateRequest(RescheduleAssignmentZodSchema),
  AssignmentController.rescheduleAssignment,
);

router.patch(
  "/:assignmentId/confirm",
  auth(Role.TECHNICIAN),
  AssignmentController.confirmAssignment,
);

router.patch(
  "/:assignmentId/cancel",
  auth(Role.TECHNICIAN, ...MANAGEMENT),
  validateRequest(CancelAssignmentZodSchema),
  AssignmentController.cancelAssignment,
);

router.get(
  "/:assignmentId",
  auth(Role.TECHNICIAN, ...MANAGEMENT),
  AssignmentController.getSingleAssignment,
);

export const AssignmentRoutes = router;
