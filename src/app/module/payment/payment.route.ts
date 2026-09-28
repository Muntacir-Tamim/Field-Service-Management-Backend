import { Router } from "express";
import { PaymentControllers } from "./payment.controller";

const router = Router();

router.post("/initiate", PaymentControllers.initiatePayment);

router.get("/callback", PaymentControllers.paymentCallback);

export const PaymentRoutes = router;
