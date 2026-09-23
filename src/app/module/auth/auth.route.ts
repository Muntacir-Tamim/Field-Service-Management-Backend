import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { AuthController } from "./auth.controller";
import { UserValidation } from "./auth.validation";
import { validateRequest } from "../../middleware/validateRequest";

const router = Router();

router.post(
  "/register",
  validateRequest(UserValidation.CustomerRegistrationZodSchema),

  AuthController.registerCustomer,
);
router.post(
  "/login",
  validateRequest(UserValidation.LoginZodSchema),
  AuthController.loginUser,
);
router.get(
  "/me",
  auth(Role.ADMIN, Role.TECHNICIAN, Role.CUSTOMER, Role.SUPER_ADMIN),
  AuthController.getMe,
);
router.post("/refresh-token", AuthController.refreshToken);
router.post("/google", AuthController.googleLogin);
export const AuthRoutes = router;
