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

// ── CUSTOMER ROUTES ──────────────────────────────────

// POST /api/v1/service-requests
// Customer service request তৈরি করবে (files optional)
router.post(
  "/",
  auth(Role.CUSTOMER),
  upload.array("attachments", 5), // max 5 files, field name: "attachments"
  validateRequest(CreateServiceRequestZodSchema),
  ServiceRequestController.createServiceRequest,
);

// GET /api/v1/service-requests/my-requests
// Customer নিজের requests দেখবে
router.get(
  "/my-requests",
  auth(Role.CUSTOMER),
  ServiceRequestController.getMyServiceRequests,
);

// PATCH /api/v1/service-requests/:serviceRequestId/cancel
// Customer নিজের request cancel করবে
router.patch(
  "/:serviceRequestId/cancel",
  auth(Role.CUSTOMER),
  ServiceRequestController.cancelServiceRequest,
);

// ── MANAGER ROUTES ───────────────────────────────────

// GET /api/v1/service-requests
// Manager/Admin সব requests দেখবে
router.get(
  "/",
  auth(Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN),
  ServiceRequestController.getAllServiceRequests,
);

// PATCH /api/v1/service-requests/:serviceRequestId/under-review
// Manager: PENDING → UNDER_REVIEW
router.patch(
  "/:serviceRequestId/under-review",
  auth(Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN),
  ServiceRequestController.markUnderReview,
);

// PATCH /api/v1/service-requests/:serviceRequestId/review
// Manager: APPROVE বা REJECT করবে
router.patch(
  "/:serviceRequestId/review",
  auth(Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(ReviewServiceRequestZodSchema),
  ServiceRequestController.reviewServiceRequest,
);

// ── SHARED ROUTES ────────────────────────────────────

// GET /api/v1/service-requests/:serviceRequestId
// Single request দেখা (Customer নিজেরটা, Technician assigned টা, Manager সব)
router.get(
  "/:serviceRequestId",
  auth(
    Role.CUSTOMER,
    Role.TECHNICIAN,
    Role.MANAGER,
    Role.ADMIN,
    Role.SUPER_ADMIN,
  ),
  ServiceRequestController.getSingleServiceRequest,
);

export const ServiceRequestRoutes = router;
