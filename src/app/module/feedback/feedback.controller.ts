import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type { IRequestUser } from "../auth/auth.interface";
import { FeedbackServices } from "./feedback.service";

const createFeedback = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;
  const result = await FeedbackServices.createFeedback(req.body, user);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Feedback submitted successfully",
    data: result,
  });
});

const updateMyFeedback = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;
  const result = await FeedbackServices.updateMyFeedback(
    req.params.feedbackId as string,
    req.body,
    user,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Feedback updated successfully",
    data: result,
  });
});

const deleteFeedback = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;
  const result = await FeedbackServices.deleteFeedback(
    req.params.feedbackId as string,
    user,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Feedback deleted successfully",
    data: result,
  });
});

const getMyFeedbacks = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;
  const { data, meta } = await FeedbackServices.getMyFeedbacks(req.query, user);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "My feedbacks retrieved successfully",
    data,
    meta,
  });
});

const getAllFeedbacks = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await FeedbackServices.getAllFeedbacks(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "All feedbacks retrieved successfully",
    data,
    meta,
  });
});

const getFeedbackByServiceRequest = catchAsync(
  async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const result = await FeedbackServices.getFeedbackByServiceRequest(
      req.params.serviceRequestId as string,
      user,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Feedback retrieved successfully",
      data: result,
    });
  },
);

const getTechnicianFeedbacks = catchAsync(
  async (req: Request, res: Response) => {
    const { data, meta, summary, technician } =
      await FeedbackServices.getTechnicianFeedbacks(
        req.params.technicianId as string,
        req.query,
      );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Technician feedbacks retrieved successfully",
      data: { technician, summary, feedbacks: data },
      meta,
    });
  },
);

const getMyTechnicianFeedbacks = catchAsync(
  async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const { data, meta, summary, technician } =
      await FeedbackServices.getMyTechnicianFeedbacks(req.query, user);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "My feedbacks retrieved successfully",
      data: { technician, summary, feedbacks: data },
      meta,
    });
  },
);

export const FeedbackController = {
  createFeedback,
  updateMyFeedback,
  deleteFeedback,
  getMyFeedbacks,
  getAllFeedbacks,
  getFeedbackByServiceRequest,
  getTechnicianFeedbacks,
  getMyTechnicianFeedbacks,
};
