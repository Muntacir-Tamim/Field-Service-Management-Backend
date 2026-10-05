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

const MANAGEMENT = [Role.ADMIN] as const;

router.post(
  "/",
  auth(Role.CUSTOMER),
  validateRequest(CreateFeedbackZodSchema),
  FeedbackController.createFeedback,
);

router.get(
  "/my-feedbacks",
  auth(Role.CUSTOMER),
  FeedbackController.getMyFeedbacks,
);

router.get(
  "/technician/my-feedbacks",
  auth(Role.TECHNICIAN),
  FeedbackController.getMyTechnicianFeedbacks,
);

router.get(
  "/technician/:technicianId",
  auth(...MANAGEMENT),
  FeedbackController.getTechnicianFeedbacks,
);

router.get(
  "/service-request/:serviceRequestId",
  auth(Role.CUSTOMER, Role.TECHNICIAN, ...MANAGEMENT),
  FeedbackController.getFeedbackByServiceRequest,
);

router.get("/", auth(...MANAGEMENT), FeedbackController.getAllFeedbacks);

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
