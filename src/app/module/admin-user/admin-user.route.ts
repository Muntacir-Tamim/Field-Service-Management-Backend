import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AdminUserController } from "./admin-user.controller";
import { UpdateUserStatusZodSchema } from "./admin-user.validation";

const router = Router();

const MANAGEMENT = [Role.ADMIN] as const;

router.get("/", auth(...MANAGEMENT), AdminUserController.getAllUsers);

router.patch(
  "/:userId/status",
  auth(...MANAGEMENT),
  validateRequest(UpdateUserStatusZodSchema),
  AdminUserController.updateUserStatus,
);

router.delete("/:userId", auth(...MANAGEMENT), AdminUserController.deleteUser);

export const AdminUserRoutes = router;
