// import { Router } from "express";
// import { PaymentControllers } from "./payment.controller";

// const router = Router();

// router.post("/initiate", PaymentControllers.initiatePayment);

// router.get("/callback", PaymentControllers.paymentCallback);

// export const PaymentRoutes = router;

import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { PaymentControllers } from "./payment.controller";
import {
  CashPaymentZodSchema,
  CreateInvoiceZodSchema,
  InitiatePaymentZodSchema,
  RefundZodSchema,
} from "./payment.validation";

const router = Router();

const MANAGEMENT = [Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN] as const;

// ── PUBLIC: bKash redirects the customer's browser here ──
// GET /api/v1/payment/callback?paymentID=&status=
router.get("/callback", PaymentControllers.paymentCallback);

// ── CUSTOMER ─────────────────────────────────────────
// GET /api/v1/payment/my-invoices
router.get(
  "/my-invoices",
  auth(Role.CUSTOMER),
  PaymentControllers.getMyInvoices,
);

// POST /api/v1/payment/initiate   (body: paymentId)
router.post(
  "/initiate",
  auth(Role.CUSTOMER),
  validateRequest(InitiatePaymentZodSchema),
  PaymentControllers.initiatePayment,
);

// ── MANAGER ──────────────────────────────────────────
// POST /api/v1/payment/invoices   (generate invoice from VERIFIED work order)
router.post(
  "/invoices",
  auth(...MANAGEMENT),
  validateRequest(CreateInvoiceZodSchema),
  PaymentControllers.createInvoice,
);

// GET /api/v1/payment/invoices?status=&from=&to=&page=&limit=
router.get("/invoices", auth(...MANAGEMENT), PaymentControllers.getAllInvoices);

// PATCH /api/v1/payment/invoices/:paymentId/cash
router.patch(
  "/invoices/:paymentId/cash",
  auth(...MANAGEMENT),
  validateRequest(CashPaymentZodSchema),
  PaymentControllers.markCashPaid,
);

// PATCH /api/v1/payment/invoices/:paymentId/refund
router.patch(
  "/invoices/:paymentId/refund",
  auth(...MANAGEMENT),
  validateRequest(RefundZodSchema),
  PaymentControllers.refundPayment,
);

// ── SHARED (customer sees only own invoice) ──────────
// GET /api/v1/payment/invoices/:paymentId/pdf
router.get(
  "/invoices/:paymentId/pdf",
  auth(Role.CUSTOMER, ...MANAGEMENT),
  PaymentControllers.downloadInvoicePdf,
);

// GET /api/v1/payment/invoices/:paymentId
router.get(
  "/invoices/:paymentId",
  auth(Role.CUSTOMER, ...MANAGEMENT),
  PaymentControllers.getSingleInvoice,
);

export const PaymentRoutes = router;
