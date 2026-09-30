import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import multer from "multer";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AppError } from "../../utils/AppError";
import { TechnicianController } from "./Technician.controller";
import {
  AddSkillZodSchema,
  ResendOtpZodSchema,
  ReviewTechnicianZodSchema,
  UpdateAvailabilityZodSchema,
  UpdateTechnicianProfileZodSchema,
  VerifyTechnicianEmailZodSchema,
} from "./Technician.validation";

const router = Router();

const MANAGEMENT = [Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN] as const;

// ── file upload: max 5MB each, only PDF / images ─────
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
const uploadApplicationFiles = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  uploader.fields([
    { name: "resume", maxCount: 1 },
    { name: "documents", maxCount: 5 },
  ])(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return next(new AppError(400, `Upload error: ${err.message}`));
    }
    next(err);
  });
};

// ── PUBLIC: technician applies ───────────────────────
// POST /api/v1/technicians/apply   (multipart: data + resume + documents[])
router.post(
  "/apply",
  uploadApplicationFiles,
  TechnicianController.applyAsTechnician,
);

router.post(
  "/apply/verify-email",
  validateRequest(VerifyTechnicianEmailZodSchema),
  TechnicianController.verifyTechnicianEmail,
);

router.post(
  "/apply/resend-otp",
  validateRequest(ResendOtpZodSchema),
  TechnicianController.resendApplicationOtp,
);

// ── TECHNICIAN (own data) — static paths before "/:technicianId" ──
router.get(
  "/my-profile",
  auth(Role.TECHNICIAN),
  TechnicianController.getMyProfile,
);

router.patch(
  "/my-profile",
  auth(Role.TECHNICIAN),
  validateRequest(UpdateTechnicianProfileZodSchema),
  TechnicianController.updateMyProfile,
);

router.patch(
  "/my-availability",
  auth(Role.TECHNICIAN),
  validateRequest(UpdateAvailabilityZodSchema),
  TechnicianController.updateMyAvailability,
);

router.post(
  "/my-skills",
  auth(Role.TECHNICIAN),
  validateRequest(AddSkillZodSchema),
  TechnicianController.addMySkill,
);

router.delete(
  "/my-skills/:skillId",
  auth(Role.TECHNICIAN),
  TechnicianController.removeMySkill,
);

// ── MANAGER / ADMIN ──────────────────────────────────
router.get("/", auth(...MANAGEMENT), TechnicianController.getAllTechnicians);

router.get(
  "/:technicianId",
  auth(...MANAGEMENT),
  TechnicianController.getSingleTechnician,
);

router.patch(
  "/:technicianId/review",
  auth(...MANAGEMENT),
  validateRequest(ReviewTechnicianZodSchema),
  TechnicianController.reviewTechnician,
);

export const TechnicianRoutes = router;
