// import { Request, Response } from "express";
// import httpStatus from "http-status";
// import { catchAsync } from "../../utils/catchAsync";
// import { sendResponse } from "../../utils/sendResponse";
// import { PaymentServices } from "./payment.service";

// const initiatePayment = catchAsync(async (req: Request, res: Response) => {
//   const { workOrderId } = req.body; // ← এটাই শুধু add হয়েছে

//   const result = await PaymentServices.initiatePayment(workOrderId); // ← workOrderId pass করো
//   sendResponse(res, {
//     statusCode: httpStatus.OK,
//     success: true,
//     message: "Payment initiated successfully",
//     data: result,
//   });
// });

// const paymentCallback = catchAsync(async (req: Request, res: Response) => {
//   console.log(req.query, "req.query");
//   const { executedPaymentResult, redirectUrl } =
//     await PaymentServices.paymentCallback(req.query);

//   console.log({ executedPaymentResult }, "callback controller");

//   res.redirect(redirectUrl); // এটা same থাকবে
// });

// export const PaymentControllers = {
//   initiatePayment,
//   paymentCallback,
// };
import { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { PaymentServices } from "./payment.service";

const initiatePayment = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentServices.initiatePayment();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment initiated successfully",
    data: result,
  });
});

const paymentCallback = catchAsync(async (req: Request, res: Response) => {
  console.log(req.query, "req.query");
  const { executedPaymentResult, redirectUrl } =
    await PaymentServices.paymentCallback(req.query);

  console.log({ executedPaymentResult }, "callback controller");

  res.redirect(redirectUrl);
  //   sendResponse(res, {
  //     statusCode: httpStatus.OK,
  //     success: true,
  //     message: "Payment callback successful",
  //     data: executedPaymentResult,
});

export const PaymentControllers = {
  initiatePayment,
  paymentCallback,
};
