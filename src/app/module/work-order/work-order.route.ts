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

const MANAGEMENT = [Role.MANAGER] as const;

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

router.get(
  "/my-work-orders",
  auth(Role.TECHNICIAN),
  WorkOrderController.getMyWorkOrders,
);

router.get(
  "/service-request/:serviceRequestId",
  auth(Role.CUSTOMER, Role.TECHNICIAN, ...MANAGEMENT),
  WorkOrderController.getWorkOrdersByServiceRequest,
);

router.get("/", auth(...MANAGEMENT), WorkOrderController.getAllWorkOrders);

router.patch(
  "/:workOrderId/en-route",
  auth(Role.TECHNICIAN),
  WorkOrderController.markEnRoute,
);

router.patch(
  "/:workOrderId/arrived",
  auth(Role.TECHNICIAN),
  WorkOrderController.markArrived,
);

router.patch(
  "/:workOrderId/start",
  auth(Role.TECHNICIAN),
  validateRequest(StartWorkZodSchema),
  WorkOrderController.startWork,
);

router.patch(
  "/:workOrderId/complete",
  auth(Role.TECHNICIAN),
  uploadCompletionImage,
  validateRequest(CompleteWorkZodSchema),
  WorkOrderController.completeWork,
);

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

router.put(
  "/:workOrderId/service-report",
  auth(Role.TECHNICIAN),
  validateRequest(ServiceReportZodSchema),
  WorkOrderController.upsertServiceReport,
);

router.patch(
  "/:workOrderId/verify",
  auth(...MANAGEMENT),
  WorkOrderController.verifyWorkOrder,
);

router.get(
  "/:workOrderId",
  auth(Role.CUSTOMER, Role.TECHNICIAN, ...MANAGEMENT),
  WorkOrderController.getSingleWorkOrder,
);

export const WorkOrderRoutes = router;
