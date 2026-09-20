import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { AuthController } from "./auth.controller";

const router = Router();

router.post("/register", AuthController.registerCustomer);
router.post("/login", AuthController.loginUser);
router.get(
  "/me",
  auth(Role.ADMIN, Role.TECHNICIAN, Role.CUSTOMER, Role.SUPER_ADMIN),
  AuthController.getMe,
);
router.post("/refresh-token", AuthController.refreshToken);
export const AuthRoutes = router;
