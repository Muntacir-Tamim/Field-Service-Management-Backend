import type { NextFunction, Request, RequestHandler, Response } from "express";
import { Router } from "express";
import multer from "multer";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AppError } from "../../utils/AppError";
import { WorkOrderController } from "./work-order.controller";
import {
  AddPartZodSchema,
  CompleteWorkZodSchema,
  ServiceReportZodSchema,
  StartWorkZodSchema,
} from "./work-order.validation";

const router = Router();

const MANAGEMENT = [Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN] as const;

// ── file upload: max 5MB each, only images / PDF ─────
const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      return cb(
        new AppError(400, "Only PDF, JPG, PNG or WEBP files are allowed"),
      );
    }
    cb(null, true);
  },
});

// turns MulterError (file too large etc.) into a clean 400
const handleUpload =
  (middleware: RequestHandler) =>
  (req: Request, res: Response, next: NextFunction) => {
    middleware(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return next(new AppError(400, `Upload error: ${err.message}`));
      }
      next(err);
    });
  };

const uploadAttachments = handleUpload(uploader.array("attachments", 5));
const uploadCompletionImage = handleUpload(uploader.single("completionImage"));

// ── LISTS (static paths first, before "/:workOrderId") ──

// GET /api/v1/work-orders/my-work-orders?status=&from=&to=&page=&limit=
router.get(
  "/my-work-orders",
  auth(Role.TECHNICIAN),
  WorkOrderController.getMyWorkOrders,
);

// GET /api/v1/work-orders/service-request/:serviceRequestId
router.get(
  "/service-request/:serviceRequestId",
  auth(Role.CUSTOMER, Role.TECHNICIAN, ...MANAGEMENT),
  WorkOrderController.getWorkOrdersByServiceRequest,
);

// GET /api/v1/work-orders
router.get("/", auth(...MANAGEMENT), WorkOrderController.getAllWorkOrders);

// ── TECHNICIAN: status flow ──────────────────────────

// SCHEDULED -> TECHNICIAN_EN_ROUTE
router.patch(
  "/:workOrderId/en-route",
  auth(Role.TECHNICIAN),
  WorkOrderController.markEnRoute,
);

// TECHNICIAN_EN_ROUTE -> ARRIVED
router.patch(
  "/:workOrderId/arrived",
  auth(Role.TECHNICIAN),
  WorkOrderController.markArrived,
);

// ARRIVED -> IN_PROGRESS   (body: problemFound, workDescription)
router.patch(
  "/:workOrderId/start",
  auth(Role.TECHNICIAN),
  validateRequest(StartWorkZodSchema),
  WorkOrderController.startWork,
);

// IN_PROGRESS -> COMPLETED
// multipart: laborHours, completionNotes, completionImage (optional file)
router.patch(
  "/:workOrderId/complete",
  auth(Role.TECHNICIAN),
  uploadCompletionImage,
  validateRequest(CompleteWorkZodSchema),
  WorkOrderController.completeWork,
);

// ── TECHNICIAN: parts ────────────────────────────────
router.post(
  "/:workOrderId/parts",
  auth(Role.TECHNICIAN),
  validateRequest(AddPartZodSchema),
  WorkOrderController.addPart,
);

router.delete(
  "/:workOrderId/parts/:partId",
  auth(Role.TECHNICIAN),
  WorkOrderController.removePart,
);

// ── TECHNICIAN: attachments (multipart, field "attachments", max 5) ──
router.post(
  "/:workOrderId/attachments",
  auth(Role.TECHNICIAN),
  uploadAttachments,
  WorkOrderController.addAttachments,
);

router.delete(
  "/:workOrderId/attachments/:attachmentId",
  auth(Role.TECHNICIAN),
  WorkOrderController.removeAttachment,
);

// ── TECHNICIAN: service report (create or update) ────
router.put(
  "/:workOrderId/service-report",
  auth(Role.TECHNICIAN),
  validateRequest(ServiceReportZodSchema),
  WorkOrderController.upsertServiceReport,
);

// ── MANAGER: verify (COMPLETED -> VERIFIED) ──────────
router.patch(
  "/:workOrderId/verify",
  auth(...MANAGEMENT),
  WorkOrderController.verifyWorkOrder,
);

// ── SHARED: single work order (customer/technician only their own) ──
router.get(
  "/:workOrderId",
  auth(Role.CUSTOMER, Role.TECHNICIAN, ...MANAGEMENT),
  WorkOrderController.getSingleWorkOrder,
);

export const WorkOrderRoutes = router;
