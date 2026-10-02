import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { FeedbackController } from "./feedback.controller";
import {
  CreateFeedbackZodSchema,
  UpdateFeedbackZodSchema,
} from "./feedback.validation";

const router = Router();

const MANAGEMENT = [Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN] as const;

// ── CUSTOMER ─────────────────────────────────────────
// POST /api/v1/feedbacks
router.post(
  "/",
  auth(Role.CUSTOMER),
  validateRequest(CreateFeedbackZodSchema),
  FeedbackController.createFeedback,
);

// GET /api/v1/feedbacks/my-feedbacks
router.get(
  "/my-feedbacks",
  auth(Role.CUSTOMER),
  FeedbackController.getMyFeedbacks,
);

// ── TECHNICIAN ───────────────────────────────────────
// GET /api/v1/feedbacks/technician/my-feedbacks
router.get(
  "/technician/my-feedbacks",
  auth(Role.TECHNICIAN),
  FeedbackController.getMyTechnicianFeedbacks,
);

// ── MANAGEMENT ───────────────────────────────────────
// GET /api/v1/feedbacks/technician/:technicianId
router.get(
  "/technician/:technicianId",
  auth(...MANAGEMENT),
  FeedbackController.getTechnicianFeedbacks,
);

// GET /api/v1/feedbacks/service-request/:serviceRequestId
router.get(
  "/service-request/:serviceRequestId",
  auth(Role.CUSTOMER, Role.TECHNICIAN, ...MANAGEMENT),
  FeedbackController.getFeedbackByServiceRequest,
);

// GET /api/v1/feedbacks?rating=5&technicianId=...&page=1&limit=10
router.get("/", auth(...MANAGEMENT), FeedbackController.getAllFeedbacks);

// ── "/:feedbackId" shobar sheshe ─────────────────────
router.patch(
  "/:feedbackId",
  auth(Role.CUSTOMER),
  validateRequest(UpdateFeedbackZodSchema),
  FeedbackController.updateMyFeedback,
);

router.delete(
  "/:feedbackId",
  auth(Role.CUSTOMER, ...MANAGEMENT),
  FeedbackController.deleteFeedback,
);

export const FeedbackRoutes = router;
