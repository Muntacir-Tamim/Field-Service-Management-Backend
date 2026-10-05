import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type { IRequestUser } from "../auth/auth.interface";
import type { IWorkOrderQuery } from "./work-order.interface";
import { WorkOrderServices } from "./work-order.service";

const markEnRoute = catchAsync(async (req: Request, res: Response) => {
  const result = await WorkOrderServices.markEnRoute(
    req.params.workOrderId as string,
    req.user as IRequestUser,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Work order updated: technician is on the way",
    data: result,
  });
});

const markArrived = catchAsync(async (req: Request, res: Response) => {
  const result = await WorkOrderServices.markArrived(
    req.params.workOrderId as string,
    req.user as IRequestUser,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Work order updated: technician arrived",
    data: result,
  });
});

const startWork = catchAsync(async (req: Request, res: Response) => {
  const result = await WorkOrderServices.startWork(
    req.params.workOrderId as string,
    req.body,
    req.user as IRequestUser,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Work started",
    data: result,
  });
});

const completeWork = catchAsync(async (req: Request, res: Response) => {
  const result = await WorkOrderServices.completeWork(
    req.params.workOrderId as string,
    req.body,
    req.file,
    req.user as IRequestUser,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Work completed. Waiting for admin verification.",
    data: result,
  });
});

const addPart = catchAsync(async (req: Request, res: Response) => {
  const result = await WorkOrderServices.addPart(
    req.params.workOrderId as string,
    req.body,
    req.user as IRequestUser,
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Part added successfully",
    data: result,
  });
});

const removePart = catchAsync(async (req: Request, res: Response) => {
  const result = await WorkOrderServices.removePart(
    req.params.workOrderId as string,
    req.params.partId as string,
    req.user as IRequestUser,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Part removed successfully",
    data: result,
  });
});

const addAttachments = catchAsync(async (req: Request, res: Response) => {
  const result = await WorkOrderServices.addAttachments(
    req.params.workOrderId as string,
    (req.files as Express.Multer.File[]) ?? [],
    req.user as IRequestUser,
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Attachments uploaded successfully",
    data: result,
  });
});

const removeAttachment = catchAsync(async (req: Request, res: Response) => {
  const result = await WorkOrderServices.removeAttachment(
    req.params.workOrderId as string,
    req.params.attachmentId as string,
    req.user as IRequestUser,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Attachment removed successfully",
    data: result,
  });
});

const upsertServiceReport = catchAsync(async (req: Request, res: Response) => {
  const result = await WorkOrderServices.upsertServiceReport(
    req.params.workOrderId as string,
    req.body,
    req.user as IRequestUser,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Service report saved successfully",
    data: result,
  });
});

const verifyWorkOrder = catchAsync(async (req: Request, res: Response) => {
  const result = await WorkOrderServices.verifyWorkOrder(
    req.params.workOrderId as string,
    req.user as IRequestUser,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Work order verified successfully",
    data: result,
  });
});

const getAllWorkOrders = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await WorkOrderServices.getAllWorkOrders(
    req.query as unknown as IWorkOrderQuery,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Work orders retrieved successfully",
    data,
    meta,
  });
});

const getMyWorkOrders = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await WorkOrderServices.getMyWorkOrders(
    req.query as unknown as IWorkOrderQuery,
    req.user as IRequestUser,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "My work orders retrieved successfully",
    data,
    meta,
  });
});

const getSingleWorkOrder = catchAsync(async (req: Request, res: Response) => {
  const result = await WorkOrderServices.getSingleWorkOrder(
    req.params.workOrderId as string,
    req.user as IRequestUser,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Work order retrieved successfully",
    data: result,
  });
});

const getWorkOrdersByServiceRequest = catchAsync(
  async (req: Request, res: Response) => {
    const result = await WorkOrderServices.getWorkOrdersByServiceRequest(
      req.params.serviceRequestId as string,
      req.user as IRequestUser,
    );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Work orders retrieved successfully",
      data: result,
    });
  },
);

export const WorkOrderController = {
  markEnRoute,
  markArrived,
  startWork,
  completeWork,
  addPart,
  removePart,
  addAttachments,
  removeAttachment,
  upsertServiceReport,
  verifyWorkOrder,
  getAllWorkOrders,
  getMyWorkOrders,
  getSingleWorkOrder,
  getWorkOrdersByServiceRequest,
};
