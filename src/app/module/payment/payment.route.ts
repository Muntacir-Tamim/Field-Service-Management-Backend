import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { PaymentControllers } from "./payment.controller";
import {
  CreateInvoiceZodSchema,
  InitiatePaymentZodSchema,
  RefundZodSchema,
} from "./payment.validation";

const router = Router();

const MANAGEMENT = [Role.MANAGER] as const;

router.get("/callback", PaymentControllers.paymentCallback);

router.get(
  "/my-invoices",
  auth(Role.CUSTOMER),
  PaymentControllers.getMyInvoices,
);

router.post(
  "/initiate",
  auth(Role.CUSTOMER),
  validateRequest(InitiatePaymentZodSchema),
  PaymentControllers.initiatePayment,
);

router.post(
  "/invoices",
  auth(...MANAGEMENT),
  validateRequest(CreateInvoiceZodSchema),
  PaymentControllers.createInvoice,
);

router.get("/invoices", auth(...MANAGEMENT), PaymentControllers.getAllInvoices);

router.patch(
  "/invoices/:paymentId/refund",
  auth(...MANAGEMENT),
  validateRequest(RefundZodSchema),
  PaymentControllers.refundPayment,
);

router.get(
  "/invoices/:paymentId/pdf",
  auth(Role.CUSTOMER, ...MANAGEMENT),
  PaymentControllers.downloadInvoicePdf,
);

router.get(
  "/invoices/:paymentId",
  auth(Role.CUSTOMER, ...MANAGEMENT),
  PaymentControllers.getSingleInvoice,
);

export const PaymentRoutes = router;
