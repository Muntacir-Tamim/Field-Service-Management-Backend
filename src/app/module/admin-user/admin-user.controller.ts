import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type { IRequestUser } from "../auth/auth.interface";
import { AdminUserServices } from "./admin-user.service";
import { GetUsersQueryZodSchema } from "./admin-user.validation";

const getAllUsers = catchAsync(async (req: Request, res: Response) => {
  // invalid query hole ZodError throw hoy -> globalErrorHandler 400 dey
  const query = GetUsersQueryZodSchema.parse(req.query);
  const { data, meta } = await AdminUserServices.getAllUsers(query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Users retrieved successfully",
    data,
    meta,
  });
});

const updateUserStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminUserServices.updateUserStatus(
    req.params.userId as string,
    req.body,
    req.user as IRequestUser,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `User ${result.status === "BLOCKED" ? "blocked" : "unblocked"} successfully`,
    data: result,
  });
});

const deleteUser = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminUserServices.deleteUser(
    req.params.userId as string,
    req.user as IRequestUser,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User deleted successfully",
    data: result,
  });
});

export const AdminUserController = {
  getAllUsers,
  updateUserStatus,
  deleteUser,
};
