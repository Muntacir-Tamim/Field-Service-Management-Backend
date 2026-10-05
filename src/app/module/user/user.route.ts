import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { upload } from "../../lib/multer";
import { auth } from "../../middleware/checkAuth";
import { UserController } from "./user.controller";
import { validateProfileUpdate } from "./user.validation";

const router = Router();

const ALL_ROLES = [Role.ADMIN, Role.TECHNICIAN, Role.CUSTOMER] as const;

// GET /api/v1/users/me
router.get("/me", auth(...ALL_ROLES), UserController.getMyProfile);

// PATCH /api/v1/users/me  (auth -> role-wise validation -> controller)
router.patch(
  "/me",
  auth(...ALL_ROLES),
  validateProfileUpdate,
  UserController.updateMyProfile,
);

// PATCH /api/v1/users/me/profile-image
router.patch(
  "/me/profile-image",
  auth(...ALL_ROLES),
  upload.single("profileImage"),
  UserController.uploadProfileImage,
);

// Purono path (/users/profile-image) — Postman collection update korle eta muche dite paro
router.patch(
  "/profile-image",
  auth(...ALL_ROLES),
  upload.single("profileImage"),
  UserController.uploadProfileImage,
);

export const UserRoutes = router;
