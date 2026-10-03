import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type { IRequestUser } from "../auth/auth.interface";
import { PaymentServices } from "./payment.service";
import { IInvoiceQuery } from "./payment.interface";
import { streamInvoicePdf } from "./payment.invoice-pdf";

const createInvoice = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentServices.createInvoice(req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Invoice created successfully",
    data: result,
  });
});

const getAllInvoices = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await PaymentServices.getAllInvoices(
    req.query as unknown as IInvoiceQuery,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Invoices retrieved successfully",
    data,
    meta,
  });
});

const getMyInvoices = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await PaymentServices.getMyInvoices(
    req.query as unknown as IInvoiceQuery,
    req.user as IRequestUser,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "My invoices retrieved successfully",
    data,
    meta,
  });
});

const getSingleInvoice = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentServices.getSingleInvoice(
    req.params.paymentId as string,
    req.user as IRequestUser,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Invoice retrieved successfully",
    data: result,
  });
});

const downloadInvoicePdf = catchAsync(async (req: Request, res: Response) => {
  const invoice = await PaymentServices.getSingleInvoice(
    req.params.paymentId as string,
    req.user as IRequestUser,
  );
  streamInvoicePdf(invoice, res);
});

const initiatePayment = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentServices.initiatePayment(
    req.body,
    req.user as IRequestUser,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment initiated successfully",
    data: result,
  });
});

const paymentCallback = catchAsync(async (req: Request, res: Response) => {
  const { redirectUrl } = await PaymentServices.paymentCallback(req.query);
  res.redirect(redirectUrl);
});

const markCashPaid = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentServices.markCashPaid(
    req.params.paymentId as string,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Invoice marked as paid (cash)",
    data: result,
  });
});

const refundPayment = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentServices.refundPayment(
    req.params.paymentId as string,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment refunded successfully",
    data: result,
  });
});

export const PaymentControllers = {
  createInvoice,
  getAllInvoices,
  getMyInvoices,
  getSingleInvoice,
  downloadInvoicePdf,
  initiatePayment,
  paymentCallback,
  markCashPaid,
  refundPayment,
};
