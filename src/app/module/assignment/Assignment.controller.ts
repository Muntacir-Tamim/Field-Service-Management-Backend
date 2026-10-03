import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type { IRequestUser } from "../auth/auth.interface";
import { AssignmentServices } from "./Assignment.service";

const createAssignment = catchAsync(async (req: Request, res: Response) => {
  const result = await AssignmentServices.createAssignment(
    req.body,
    req.user as IRequestUser,
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Technician assigned successfully. Waiting for confirmation.",
    data: result,
  });
});

const getAvailableTechnicians = catchAsync(
  async (req: Request, res: Response) => {
    const result = await AssignmentServices.getAvailableTechnicians(req.query);
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Available technicians retrieved successfully",
      data: result,
    });
  },
);

const getAllAssignments = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await AssignmentServices.getAllAssignments(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Assignments retrieved successfully",
    data,
    meta,
  });
});

const getMyAssignments = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await AssignmentServices.getMyAssignments(
    req.query,
    req.user as IRequestUser,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "My assignments retrieved successfully",
    data,
    meta,
  });
});

const getSingleAssignment = catchAsync(async (req: Request, res: Response) => {
  const result = await AssignmentServices.getSingleAssignment(
    req.params.assignmentId as string,
    req.user as IRequestUser,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Assignment retrieved successfully",
    data: result,
  });
});

const confirmAssignment = catchAsync(async (req: Request, res: Response) => {
  const result = await AssignmentServices.confirmAssignment(
    req.params.assignmentId as string,
    req.user as IRequestUser,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Assignment confirmed. Work order created.",
    data: result,
  });
});

const cancelAssignment = catchAsync(async (req: Request, res: Response) => {
  const result = await AssignmentServices.cancelAssignment(
    req.params.assignmentId as string,
    req.body,
    req.user as IRequestUser,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Assignment cancelled successfully",
    data: result,
  });
});

const rescheduleAssignment = catchAsync(async (req: Request, res: Response) => {
  const result = await AssignmentServices.rescheduleAssignment(
    req.params.assignmentId as string,
    req.body,
    req.user as IRequestUser,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message:
      "Assignment rescheduled. New assignment is waiting for confirmation.",
    data: result,
  });
});

export const AssignmentController = {
  createAssignment,
  getAvailableTechnicians,
  getAllAssignments,
  getMyAssignments,
  getSingleAssignment,
  confirmAssignment,
  cancelAssignment,
  rescheduleAssignment,
};
