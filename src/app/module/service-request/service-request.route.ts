import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { upload } from "../../lib/multer";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { ServiceRequestController } from "./service-request.controller";
import {
  CreateServiceRequestZodSchema,
  ReviewServiceRequestZodSchema,
} from "./service-request.validation";

const router = Router();

router.post(
  "/",
  auth(Role.CUSTOMER),
  upload.array("attachments", 5), // max 5 files, field name: "attachments"
  validateRequest(CreateServiceRequestZodSchema),
  ServiceRequestController.createServiceRequest,
);

router.get(
  "/my-requests",
  auth(Role.CUSTOMER),
  ServiceRequestController.getMyServiceRequests,
);

router.patch(
  "/:serviceRequestId/cancel",
  auth(Role.CUSTOMER),
  ServiceRequestController.cancelServiceRequest,
);

router.get(
  "/",
  auth(Role.MANAGER),
  ServiceRequestController.getAllServiceRequests,
);

router.patch(
  "/:serviceRequestId/under-review",
  auth(Role.MANAGER),
  ServiceRequestController.markUnderReview,
);

router.patch(
  "/:serviceRequestId/review",
  auth(Role.MANAGER),
  validateRequest(ReviewServiceRequestZodSchema),
  ServiceRequestController.reviewServiceRequest,
);

router.get(
  "/:serviceRequestId",
  auth(Role.CUSTOMER, Role.TECHNICIAN, Role.MANAGER),
  ServiceRequestController.getSingleServiceRequest,
);

export const ServiceRequestRoutes = router;
