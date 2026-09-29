import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type { IRequestUser } from "../auth/auth.interface";
import { ServiceRequestServices } from "./service-request.service";

const createServiceRequest = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;
  const user = req.user as IRequestUser;
  const files = (req.files as Express.Multer.File[]) ?? [];

  const result = await ServiceRequestServices.createServiceRequest(
    payload,
    files,
    user,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Service Request Created Successfully",
    data: result,
  });
});

const reviewServiceRequest = catchAsync(async (req: Request, res: Response) => {
  const serviceRequestId = req.params.serviceRequestId as string;
  const payload = req.body;
  const user = req.user as IRequestUser;

  const result = await ServiceRequestServices.reviewServiceRequest(
    serviceRequestId,
    payload,
    user,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Service Request ${payload.status} Successfully`,
    data: result,
  });
});

const cancelServiceRequest = catchAsync(async (req: Request, res: Response) => {
  const serviceRequestId = req.params.serviceRequestId as string;
  const user = req.user as IRequestUser;

  const result = await ServiceRequestServices.cancelServiceRequest(
    serviceRequestId,
    user,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Service Request Cancelled Successfully",
    data: result,
  });
});

const getMyServiceRequests = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;

  const { data, meta } = await ServiceRequestServices.getMyServiceRequests(
    req.query,
    user,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Service Requests Retrieved Successfully",
    data,
    meta,
  });
});

const getAllServiceRequests = catchAsync(
  async (req: Request, res: Response) => {
    const { data, meta } = await ServiceRequestServices.getAllServiceRequests(
      req.query,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "All Service Requests Retrieved Successfully",
      data,
      meta,
    });
  },
);

const getSingleServiceRequest = catchAsync(
  async (req: Request, res: Response) => {
    const serviceRequestId = req.params.serviceRequestId as string;
    const user = req.user as IRequestUser;

    const result = await ServiceRequestServices.getSingleServiceRequest(
      serviceRequestId,
      user,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Service Request Retrieved Successfully",
      data: result,
    });
  },
);

const markUnderReview = catchAsync(async (req: Request, res: Response) => {
  const serviceRequestId = req.params.serviceRequestId as string;
  const user = req.user as IRequestUser;

  const result = await ServiceRequestServices.markUnderReview(
    serviceRequestId,
    user,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Service Request Marked As Under Review",
    data: result,
  });
});

export const ServiceRequestController = {
  createServiceRequest,
  reviewServiceRequest,
  cancelServiceRequest,
  getMyServiceRequests,
  getAllServiceRequests,
  getSingleServiceRequest,
  markUnderReview,
};
