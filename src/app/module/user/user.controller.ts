import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type { IRequestUser } from "../auth/auth.interface";
import { UserServices } from "./user.service";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

const getMyProfile = catchAsync(async (req: Request, res: Response) => {
  const result = await UserServices.getMyProfile(req.user as IRequestUser);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile retrieved successfully",
    data: result,
  });
});

const updateMyProfile = catchAsync(async (req: Request, res: Response) => {
  const result = await UserServices.updateMyProfile(
    req.user as IRequestUser,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile updated successfully",
    data: result,
  });
});

const uploadProfileImage = catchAsync(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new AppError(httpStatus.BAD_REQUEST, "No file provided.");
  }
  if (!req.file.mimetype.startsWith("image/")) {
    throw new AppError(httpStatus.BAD_REQUEST, "Only image files are allowed");
  }
  if (req.file.size > MAX_IMAGE_SIZE) {
    throw new AppError(httpStatus.BAD_REQUEST, "Image must be 5MB or smaller");
  }

  const result = await UserServices.uploadProfileImage(
    req.file.buffer,
    (req.user as IRequestUser).userId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile image updated successfully",
    data: result,
  });
});

export const UserController = {
  getMyProfile,
  updateMyProfile,
  uploadProfileImage,
};
