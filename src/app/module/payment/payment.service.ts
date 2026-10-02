import crypto from "crypto";
import { format } from "date-fns";
import httpStatus from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import type { PaymentStatus } from "../../../generated/prisma/enums";
import config from "../../config";
import { getBkashIdToken } from "../../lib/bkash";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { IRequestUser } from "../auth/auth.interface";
import type {
  ICashPaymentPayload,
  ICreateInvoicePayload,
  IInitiatePaymentPayload,
  IInvoiceQuery,
  IRefundPayload,
} from "./payment.interface";

const ALL_STATUSES: PaymentStatus[] = [
  "UNPAID",
  "PAID",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
];
// invoice can be paid again from these states
const PAYABLE_STATUSES: PaymentStatus[] = ["UNPAID", "FAILED", "CANCELLED"];
const SORTABLE_FIELDS = ["createdAt", "paidAt", "totalAmount", "status"];

// ─────────────────────────────────────────────
// Reusable include
// ─────────────────────────────────────────────
const paymentInclude = {
  workOrder: {
    select: {
      id: true,
      status: true,
      laborHours: true,
      problemFound: true,
      workDescription: true,
      completedAt: true,
      verifiedAt: true,
      parts: { orderBy: { createdAt: "asc" } },
      assignment: {
        select: {
          technician: { select: { id: true, name: true } },
          serviceRequest: {
            select: {
              id: true,
              title: true,
              status: true,
              address: true,
              city: true,
              customer: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  contactNumber: true,
                  userId: true,
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.PaymentInclude;

type PaymentWithRelations = Prisma.PaymentGetPayload<{
  include: typeof paymentInclude;
}>;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const money = (value: string | number | Prisma.Decimal) =>
  new Prisma.Decimal(value).toDecimalPlaces(2);

const generateInvoiceNumber = () =>
  `FSM-INV-${format(new Date(), "yyyyMMdd")}-${crypto.randomInt(100000, 1000000)}`;

const parseDate = (value: string, label: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(httpStatus.BAD_REQUEST, `${label} is not a valid date`);
  }
  return date;
};

const parsePagination = (query: IInvoiceQuery) => {
  const page = Math.max(Number.parseInt(query.page ?? "1", 10) || 1, 1);
  const limit = Math.min(
    Math.max(Number.parseInt(query.limit ?? "10", 10) || 10, 1),
    100,
  );
  const sortBy = SORTABLE_FIELDS.includes(query.sortBy ?? "")
    ? (query.sortBy as string)
    : "createdAt";
  const sortOrder: "asc" | "desc" = query.sortOrder === "asc" ? "asc" : "desc";
  return { page, limit, skip: (page - 1) * limit, sortBy, sortOrder };
};

const buildListFilters = (query: IInvoiceQuery) => {
  const and: Prisma.PaymentWhereInput[] = [];

  if (query.status) {
    if (!ALL_STATUSES.includes(query.status as PaymentStatus)) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Invalid status. Use one of: ${ALL_STATUSES.join(", ")}`,
      );
    }
    and.push({ status: query.status as PaymentStatus });
  }
  if (query.from) {
    and.push({ createdAt: { gte: parseDate(query.from, "from") } });
  }
  if (query.to) {
    and.push({ createdAt: { lte: parseDate(query.to, "to") } });
  }
  return and;
};

// Adds the breakdown that the schema does not store:
//   partsTotal = sum of parts, laborCost = subtotal - partsTotal
// (parts cannot change after the work order is VERIFIED, so this is stable)
const toInvoiceView = (payment: PaymentWithRelations) => {
  const partsTotal = payment.workOrder.parts.reduce(
    (sum, p) => sum.add(p.totalCost),
    new Prisma.Decimal(0),
  );
  const laborCost = payment.subtotal.sub(partsTotal);

  return {
    ...payment,
    // DB default is CASH, but for an UNPAID invoice no method is chosen yet
    method:
      payment.status === "UNPAID" && !payment.gatewayPaymentId
        ? null
        : payment.method,
    breakdown: {
      partsTotal: partsTotal.toFixed(2),
      laborHours: payment.workOrder.laborHours?.toString() ?? "0",
      laborCost: laborCost.toFixed(2),
      subtotal: payment.subtotal.toFixed(2),
      discount: payment.discount.toFixed(2),
      taxAmount: payment.taxAmount.toFixed(2),
      totalAmount: payment.totalAmount.toFixed(2),
    },
  };
};

export type InvoiceView = ReturnType<typeof toInvoiceView>;

const isOwner = (payment: PaymentWithRelations, user: IRequestUser) =>
  payment.workOrder.assignment.serviceRequest.customer.userId === user.userId;

const getPaymentOrThrow = async (paymentId: string) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: paymentInclude,
  });
  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, "Invoice Not Found");
  }
  return payment;
};

const getCustomerPaymentOrThrow = async (
  paymentId: string,
  user: IRequestUser,
) => {
  const payment = await getPaymentOrThrow(paymentId);
  // same message for "missing" and "not yours"
  if (!isOwner(payment, user)) {
    throw new AppError(httpStatus.NOT_FOUND, "Invoice Not Found");
  }
  return payment;
};

// ─────────────────────────────────────────────
// bKash helper
// ─────────────────────────────────────────────
const callBkash = async (path: string, body: Record<string, unknown>) => {
  const idToken = await getBkashIdToken();
  if (!idToken) {
    throw new AppError(httpStatus.BAD_GATEWAY, "No bKash access token found");
  }

  const response = await fetch(`${config.bkash_base_url}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: idToken,
      "X-App-Key": config.bkash_app_key,
    },
    body: JSON.stringify(body),
  });

  return (await response.json()) as Record<string, any>;
};

// ─────────────────────────────────────────────
// MANAGER: generate invoice from a VERIFIED work order
//   subtotal = parts + laborHours * LABOR_RATE_PER_HOUR
//   total    = subtotal - discount + tax
// ─────────────────────────────────────────────
const createInvoice = async (payload: ICreateInvoicePayload) => {
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: payload.workOrderId },
    include: { parts: true, payment: { select: { id: true } } },
  });

  if (!workOrder) {
    throw new AppError(httpStatus.NOT_FOUND, "Work Order Not Found");
  }
  if (workOrder.status !== "VERIFIED") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Invoice can only be created for a VERIFIED work order. Current status: ${workOrder.status}`,
    );
  }
  if (workOrder.payment) {
    throw new AppError(
      httpStatus.CONFLICT,
      "An invoice already exists for this work order",
    );
  }
  if (!workOrder.laborHours) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Work order has no labor hours recorded",
    );
  }

  const partsTotal = workOrder.parts.reduce(
    (sum, p) => sum.add(p.totalCost),
    new Prisma.Decimal(0),
  );
  const laborCost = workOrder.laborHours.mul(config.labor_rate_per_hour);
  const subtotal = money(partsTotal.add(laborCost));

  const discount = money(payload.discount ?? 0);
  if (discount.gt(subtotal)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Discount cannot be more than the subtotal",
    );
  }

  const taxPercent = payload.taxPercent ?? config.tax_rate_percent;
  const taxAmount = money(subtotal.sub(discount).mul(taxPercent).div(100));
  const totalAmount = money(subtotal.sub(discount).add(taxAmount));

  if (totalAmount.lte(0)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Invoice total must be greater than 0",
    );
  }

  // invoiceNumber is random + unique; retry on the rare collision
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const created = await prisma.payment.create({
        data: {
          workOrderId: workOrder.id,
          invoiceNumber: generateInvoiceNumber(),
          status: "UNPAID",
          currency: "BDT",
          subtotal,
          discount,
          taxAmount,
          totalAmount,
          dueDate: payload.dueDate,
          notes: payload.notes,
          sentAt: new Date(),
        },
        include: paymentInclude,
      });
      return toInvoiceView(created);
    } catch (error) {
      if ((error as { code?: string })?.code === "P2002") {
        const existing = await prisma.payment.findUnique({
          where: { workOrderId: workOrder.id },
          select: { id: true },
        });
        if (existing) {
          throw new AppError(
            httpStatus.CONFLICT,
            "An invoice already exists for this work order",
          );
        }
        continue; // invoice number collision -> try again
      }
      throw error;
    }
  }

  throw new AppError(
    httpStatus.INTERNAL_SERVER_ERROR,
    "Could not generate a unique invoice number. Please try again.",
  );
};

// ─────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────
const getAllInvoices = async (query: IInvoiceQuery) => {
  const { page, limit, skip, sortBy, sortOrder } = parsePagination(query);
  const where: Prisma.PaymentWhereInput = { AND: buildListFilters(query) };

  const [data, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: paymentInclude,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
    prisma.payment.count({ where }),
  ]);

  return {
    data: data.map(toInvoiceView),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

const getMyInvoices = async (query: IInvoiceQuery, user: IRequestUser) => {
  const customer = await prisma.customer.findUnique({
    where: { userId: user.userId },
    select: { id: true },
  });
  if (!customer) {
    throw new AppError(httpStatus.NOT_FOUND, "Customer Profile Not Found");
  }

  const { page, limit, skip, sortBy, sortOrder } = parsePagination(query);
  const where: Prisma.PaymentWhereInput = {
    AND: [
      ...buildListFilters(query),
      {
        workOrder: {
          assignment: { serviceRequest: { customerId: customer.id } },
        },
      },
    ],
  };

  const [data, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: paymentInclude,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
    prisma.payment.count({ where }),
  ]);

  return {
    data: data.map(toInvoiceView),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// customer: only own invoice. management: any.
const getSingleInvoice = async (paymentId: string, user: IRequestUser) => {
  const payment =
    user.role === "CUSTOMER"
      ? await getCustomerPaymentOrThrow(paymentId, user)
      : await getPaymentOrThrow(paymentId);
  return toInvoiceView(payment);
};

// ─────────────────────────────────────────────
// CUSTOMER: start bKash payment for an invoice
//   amount always comes from the DB, never from the request
// ─────────────────────────────────────────────
const initiatePayment = async (
  payload: IInitiatePaymentPayload,
  user: IRequestUser,
) => {
  const payment = await getCustomerPaymentOrThrow(payload.paymentId, user);

  if (!PAYABLE_STATUSES.includes(payment.status)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `This invoice cannot be paid. Current status: ${payment.status}`,
    );
  }

  const customer = payment.workOrder.assignment.serviceRequest.customer;
  const payerReference = customer.contactNumber || customer.email;

  const result = await callBkash("/tokenized/checkout/create", {
    mode: "0011",
    payerReference,
    callbackURL: `${config.bkash_callback_url}/payment/callback`,
    amount: payment.totalAmount.toFixed(2),
    currency: payment.currency,
    intent: "sale",
    merchantInvoiceNumber: payment.invoiceNumber,
  });

  if (
    !result.paymentID ||
    (result.statusCode && result.statusCode !== "0000")
  ) {
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      `bKash could not start the payment: ${result.statusMessage ?? "unknown error"}`,
    );
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      gatewayPaymentId: result.paymentID,
      method: "BKASH",
      payerReference,
    },
  });

  return result;
};

// ─────────────────────────────────────────────
// PUBLIC (bKash redirects the browser here)
//   never trust ?status= alone. On "success" we call bKash execute
//   and check the result + amount + invoice number before marking PAID.
// ─────────────────────────────────────────────
const redirectTo = (status: string) =>
  `${config.frontend_url}/dashboard/payments?status=${status}`;

const paymentCallback = async (query: Record<string, any>) => {
  const paymentID = query.paymentID ? String(query.paymentID) : "";
  const status = query.status ? String(query.status) : "";

  if (!paymentID || !status) {
    return { redirectUrl: redirectTo("failure") };
  }

  const payment = await prisma.payment.findUnique({
    where: { gatewayPaymentId: paymentID },
    include: {
      workOrder: {
        select: { assignment: { select: { serviceRequestId: true } } },
      },
    },
  });

  if (!payment) {
    return { redirectUrl: redirectTo("failure") };
  }

  // refresh / double callback => already done, do nothing
  if (payment.status === "PAID") {
    return { redirectUrl: redirectTo("success") };
  }

  if (status === "cancel" || status === "failure") {
    await prisma.payment.updateMany({
      where: { id: payment.id, status: { not: "PAID" } },
      data: { status: status === "cancel" ? "CANCELLED" : "FAILED" },
    });
    return { redirectUrl: redirectTo(status) };
  }

  if (status !== "success") {
    return { redirectUrl: redirectTo("failure") };
  }

  let executed: Record<string, any>;
  try {
    executed = await callBkash("/tokenized/checkout/execute", { paymentID });
  } catch (error) {
    // network problem: result unknown, do not change the status
    console.error("bKash execute failed:", error);
    return { redirectUrl: redirectTo("failure") };
  }

  const completed =
    executed.statusCode === "0000" &&
    executed.transactionStatus === "Completed";
  const amountMatches =
    money(executed.amount ?? -1).equals(payment.totalAmount) &&
    executed.currency === payment.currency;
  const invoiceMatches =
    executed.merchantInvoiceNumber === payment.invoiceNumber;

  if (!completed || !amountMatches || !invoiceMatches) {
    if (completed) {
      // money was taken but data does not match -> needs manual review
      console.error("bKash payment mismatch, review manually:", {
        paymentId: payment.id,
        executed,
      });
    }
    await prisma.payment.updateMany({
      where: { id: payment.id, status: { not: "PAID" } },
      data: {
        status: "FAILED",
        gatewayResponse: executed as Prisma.InputJsonValue,
      },
    });
    return { redirectUrl: redirectTo("failure") };
  }

  await prisma.$transaction(async (tx) => {
    // "status != PAID" in the condition => only one request can win
    const updated = await tx.payment.updateMany({
      where: { id: payment.id, status: { not: "PAID" } },
      data: {
        status: "PAID",
        method: "BKASH",
        transactionId: executed.trxID,
        gatewayResponse: executed as Prisma.InputJsonValue,
        paidAt: new Date(),
      },
    });

    if (updated.count === 1) {
      await tx.serviceRequest.update({
        where: { id: payment.workOrder.assignment.serviceRequestId },
        data: { status: "COMPLETED" },
      });
    }
  });

  return { redirectUrl: redirectTo("success") };
};

// ─────────────────────────────────────────────
// MANAGER: customer paid in cash
// ─────────────────────────────────────────────
const markCashPaid = async (
  paymentId: string,
  payload: ICashPaymentPayload,
) => {
  const payment = await getPaymentOrThrow(paymentId);

  await prisma.$transaction(async (tx) => {
    const updated = await tx.payment.updateMany({
      where: { id: paymentId, status: { in: PAYABLE_STATUSES } },
      data: {
        status: "PAID",
        method: "CASH",
        paidAt: new Date(),
        notes: payload.notes
          ? [payment.notes, `Cash: ${payload.notes}`].filter(Boolean).join("\n")
          : payment.notes,
      },
    });

    if (updated.count === 0) {
      throw new AppError(
        httpStatus.CONFLICT,
        `Invoice cannot be marked as cash paid. Current status: ${payment.status}`,
      );
    }

    await tx.serviceRequest.update({
      where: { id: payment.workOrder.assignment.serviceRequest.id },
      data: { status: "COMPLETED" },
    });
  });

  return toInvoiceView(await getPaymentOrThrow(paymentId));
};

// ─────────────────────────────────────────────
// MANAGER: full refund (PAID -> REFUNDED)
//   bKash payments call the bKash refund API first
// ─────────────────────────────────────────────
const refundPayment = async (paymentId: string, payload: IRefundPayload) => {
  const payment = await getPaymentOrThrow(paymentId);

  if (payment.status !== "PAID") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Only PAID invoices can be refunded. Current status: ${payment.status}`,
    );
  }

  let refundTransactionId: string | null = null;

  if (payment.method === "BKASH") {
    if (!payment.gatewayPaymentId || !payment.transactionId) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "bKash transaction details are missing, cannot refund",
      );
    }

    const result = await callBkash("/tokenized/checkout/payment/refund", {
      paymentId: payment.gatewayPaymentId,
      trxId: payment.transactionId,
      amount: payment.totalAmount.toFixed(2),
      sku: payment.invoiceNumber,
      reason: payload.reason,
    });

    if (result.statusCode !== "0000") {
      throw new AppError(
        httpStatus.BAD_GATEWAY,
        `bKash refund failed: ${result.statusMessage ?? "unknown error"}`,
      );
    }
    refundTransactionId = result.refundTrxId ?? null;
  }

  const updated = await prisma.payment.updateMany({
    where: { id: paymentId, status: "PAID" },
    data: {
      status: "REFUNDED",
      refundAmount: payment.totalAmount,
      refundReason: payload.reason,
      refundTransactionId,
      refundedAt: new Date(),
    },
  });

  if (updated.count === 0) {
    throw new AppError(
      httpStatus.CONFLICT,
      "Invoice was changed by someone else. Please refresh.",
    );
  }

  return toInvoiceView(await getPaymentOrThrow(paymentId));
};

export const PaymentServices = {
  createInvoice,
  getAllInvoices,
  getMyInvoices,
  getSingleInvoice,
  initiatePayment,
  paymentCallback,
  markCashPaid,
  refundPayment,
};
