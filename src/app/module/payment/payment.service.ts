// import config from "../../config";
// import { getBkashIdToken } from "../../lib/bkash";
// import { prisma } from "../../lib/prisma";

// const initiatePayment = async (workOrderId: string) => {
//   // 1. WorkOrder + Parts + Customer info নিয়ে আসো
//   const workOrder = await prisma.workOrder.findUniqueOrThrow({
//     where: { id: workOrderId },
//     include: {
//       payment: true,
//       parts: true,
//       assignment: {
//         include: {
//           serviceRequest: {
//             include: {
//               customer: {
//                 include: { user: true },
//               },
//             },
//           },
//         },
//       },
//     },
//   });

//   // 2. Already PAID থাকলে error
//   if (workOrder.payment?.status === "PAID") {
//     throw new Error("This work order is already paid.");
//   }

//   // 3. Amount calculate — WorkOrderPart থেকে
//   const subtotal = workOrder.parts.reduce(
//     (sum, part) => sum + Number(part.totalCost),
//     0,
//   );
//   const taxAmount = 0;
//   const totalAmount = subtotal + taxAmount;

//   // 4. Customer email
//   const payerReference =
//     workOrder.assignment.serviceRequest.customer.user.email;

//   // 5. Invoice number generate
//   const invoiceNumber = `FSM-INV-${Date.now()}`;

//   // 6. Payment record DB-তে create (UNPAID)
//   let payment = workOrder.payment;
//   if (!payment) {
//     payment = await prisma.payment.create({
//       data: {
//         workOrderId,
//         invoiceNumber, // schema: invoiceNumber
//         subtotal, // schema: subtotal
//         taxAmount, // schema: taxAmount
//         totalAmount, // schema: totalAmount
//         method: "BKASH", // schema: method
//         status: "UNPAID", // schema: status
//         payerReference, // schema: payerReference
//         currency: "BDT", // schema: currency
//       },
//     });
//   }

//   // 7. bKash token
//   const bkashIdToken = await getBkashIdToken();
//   if (!bkashIdToken) throw new Error("No Bkash Access Token Found!");

//   // 8. bKash payment create
//   const bkashCreatePaymentResponse = await fetch(
//     `${config.bkash_base_url}/tokenized/checkout/create`,
//     {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         Accept: "application/json",
//         Authorization: bkashIdToken,
//         "X-App-Key": config.bkash_app_key,
//       },
//       body: JSON.stringify({
//         mode: "0011",
//         payerReference: payerReference,
//         callbackURL: `${config.bkash_callback_url}/payment/callback`,
//         amount: totalAmount.toFixed(2),
//         currency: "BDT",
//         intent: "sale",
//         merchantInvoiceNumber: payment.invoiceNumber, // schema: invoiceNumber
//       }),
//     },
//   );

//   const bkashCreatePaymentResult = await bkashCreatePaymentResponse.json();

//   // 9. bKash paymentID → DB-তে save
//   await prisma.payment.update({
//     where: { id: payment.id },
//     data: { gatewayPaymentId: bkashCreatePaymentResult.paymentID }, // schema: gatewayPaymentId
//   });

//   return bkashCreatePaymentResult;
// };

// const paymentCallback = async (query: Record<string, any>) => {
//   const paymentId = query.paymentID;
//   if (!paymentId) throw new Error("Payment Id Missing");

//   const status = query.status;
//   if (!status) throw new Error("Payment Status is Missing");

//   const bkashIdToken = await getBkashIdToken();
//   if (!bkashIdToken) throw new Error("No Bkash Access Token Found!");

//   // bKash execute
//   const executedPaymentResponse = await fetch(
//     `${config.bkash_base_url}/tokenized/checkout/execute`,
//     {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         Accept: "application/json",
//         Authorization: bkashIdToken,
//         "X-App-Key": config.bkash_app_key,
//       },
//       body: JSON.stringify({ paymentID: paymentId }),
//     },
//   );

//   const executedPaymentResult = await executedPaymentResponse.json();

//   // gatewayPaymentId দিয়ে Payment খোঁজো
//   const payment = await prisma.payment.findUniqueOrThrow({
//     where: { gatewayPaymentId: paymentId },
//     include: {
//       workOrder: {
//         include: { assignment: true },
//       },
//     },
//   });

//   if (status === "success") {
//     await prisma.$transaction([
//       prisma.payment.update({
//         where: { id: payment.id },
//         data: {
//           status: "PAID", // schema: status
//           transactionId: executedPaymentResult.trxID, // schema: transactionId
//           gatewayResponse: executedPaymentResult, // schema: gatewayResponse
//           paidAt: new Date(), // schema: paidAt
//         },
//       }),
//       prisma.serviceRequest.update({
//         where: { id: payment.workOrder.assignment.serviceRequestId },
//         data: { status: "COMPLETED" },
//       }),
//     ]);

//     return {
//       executedPaymentResult,
//       redirectUrl: `${config.frontend_url}/dashboard/payments?status=success`,
//     };
//   }

//   if (status === "failure") {
//     await prisma.payment.update({
//       where: { id: payment.id },
//       data: {
//         status: "FAILED", // schema: status
//         gatewayResponse: executedPaymentResult, // schema: gatewayResponse
//       },
//     });
//     return {
//       executedPaymentResult,
//       redirectUrl: `${config.frontend_url}/dashboard/payments?status=failure`,
//     };
//   }

//   if (status === "cancel") {
//     await prisma.payment.update({
//       where: { id: payment.id },
//       data: {
//         status: "CANCELLED", // schema: status
//         gatewayResponse: executedPaymentResult, // schema: gatewayResponse
//       },
//     });
//     return {
//       executedPaymentResult,
//       redirectUrl: `${config.frontend_url}/dashboard/payments?status=cancel`,
//     };
//   }

//   return {
//     executedPaymentResult,
//     redirectUrl: `${config.frontend_url}/dashboard/payments`,
//   };
// };

// export const PaymentServices = {
//   initiatePayment,
//   paymentCallback,
// };
import config from "../../config";
import { getBkashIdToken } from "../../lib/bkash";

const initiatePayment = async () => {
  const bkashIdToken = await getBkashIdToken();

  if (!bkashIdToken) {
    throw new Error("No Bkash Access Token Found!");
  }

  const bkashCreatePaymentResponse = await fetch(
    `${config.bkash_base_url}/tokenized/checkout/create`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: bkashIdToken,
        "X-App-Key": config.bkash_app_key,
      },
      body: JSON.stringify({
        mode: "0011",
        payerReference: "01XXXXXXXXX",
        callbackURL: `${config.bkash_callback_url}/payment/callback`,
        amount: "1200",
        currency: "BDT",
        intent: "sale",
        merchantInvoiceNumber: `FSM-INV-${Date.now()}`,
      }),
    },
  );

  const bkashCreatePaymentResult = await bkashCreatePaymentResponse.json();

  return bkashCreatePaymentResult;
};

const paymentCallback = async (query: Record<string, any>) => {
  const paymentId = query.paymentID;

  if (!paymentId) {
    throw new Error("Payment Id Missing");
  }

  const status = query.status;

  if (!status) {
    throw new Error("Payment Status is Missing");
  }

  const bkashIdToken = await getBkashIdToken();

  if (!bkashIdToken) {
    throw new Error("No Bkash Access Token Found!");
  }

  const executedPaymentResponse = await fetch(
    `${config.bkash_base_url}/tokenized/checkout/execute`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: bkashIdToken,
        "X-App-Key": config.bkash_app_key,
      },
      body: JSON.stringify({
        paymentID: paymentId,
      }),
    },
  );

  const executedPaymentResult = await executedPaymentResponse.json();

  if (status === "success") {
    return {
      executedPaymentResult,
      redirectUrl: `${config.frontend_url}/dashboard/payments?status=success`,
    };
  }
  if (status === "failure") {
    return {
      executedPaymentResult,
      redirectUrl: `${config.frontend_url}/dashboard/payments?status=failure`,
    };
  }
  if (status === "cancel") {
    return {
      executedPaymentResult,
      redirectUrl: `${config.frontend_url}/dashboard/payments?status=cancel`,
    };
  }

  return {
    executedPaymentResult,
    redirectUrl: `${config.frontend_url}/dashboard/payments`,
  };
};

export const PaymentServices = {
  initiatePayment,
  paymentCallback,
};
