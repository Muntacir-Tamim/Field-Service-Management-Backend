// import { Router } from "express";
// import { Role } from "../../../generated/prisma/enums";
// import { auth } from "../../middleware/checkAuth";
// import { validateRequest } from "../../middleware/validateRequest";
// import { AuthController } from "./auth.controller";
// import { UserValidation } from "./auth.validation";

// const router = Router();

// router.post(
//   "/register",
//   validateRequest(UserValidation.CustomerRegistrationZodSchema),

//   AuthController.registerCustomer,
// );

// router.post(
//   "/verify-email",
//   validateRequest(UserValidation.CustomerEmailVerifyZodSchema),
//   AuthController.verifyCustomerEmail,
// );

// router.post(
//   "/login",
//   validateRequest(UserValidation.LoginZodSchema),
//   AuthController.loginUser,
// );
// router.get(
//   "/me",
//   auth(Role.TECHNICIAN, Role.MANAGER, Role.CUSTOMER),
//   AuthController.getMe,
// );
// router.post("/refresh-token", AuthController.refreshToken);
// // router.post("/google", AuthController.googleLogin);

// router.post(
//   "/google",
//   validateRequest(UserValidation.GoogleLoginZodSchema),
//   AuthController.googleLogin,
// );

// router.post(
//   "/forgot-password",
//   validateRequest(UserValidation.ForgotPasswordZodSchema),
//   AuthController.forgotPassword,
// );
// router.post(
//   "/reset-password",
//   validateRequest(UserValidation.ResetPasswordZodSchema),
//   AuthController.resetPassword,
// );
// export const AuthRoutes = router;

import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AuthController } from "./auth.controller";
import { UserValidation } from "./auth.validation";

const router = Router();

router.post(
  "/register",
  validateRequest(UserValidation.CustomerRegistrationZodSchema),

  AuthController.registerCustomer,
);

router.post(
  "/verify-email",
  validateRequest(UserValidation.CustomerEmailVerifyZodSchema),
  AuthController.verifyCustomerEmail,
);

router.post(
  "/login",
  validateRequest(UserValidation.LoginZodSchema),
  AuthController.loginUser,
);
router.get(
  "/me",
  auth(Role.TECHNICIAN, Role.MANAGER, Role.CUSTOMER),
  AuthController.getMe,
);
router.post("/refresh-token", AuthController.refreshToken);
router.post("/logout", AuthController.logout);
// router.post("/google", AuthController.googleLogin);

router.post(
  "/google",
  validateRequest(UserValidation.GoogleLoginZodSchema),
  AuthController.googleLogin,
);

router.post(
  "/forgot-password",
  validateRequest(UserValidation.ForgotPasswordZodSchema),
  AuthController.forgotPassword,
);
router.post(
  "/reset-password",
  validateRequest(UserValidation.ResetPasswordZodSchema),
  AuthController.resetPassword,
);
export const AuthRoutes = router;
