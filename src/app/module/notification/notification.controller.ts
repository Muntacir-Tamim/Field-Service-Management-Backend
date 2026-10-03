import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type { IRequestUser } from "../auth/auth.interface";
import { NotificationServices } from "./notification.service";

const getMyNotifications = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;
  const result = await NotificationServices.getMyNotifications(
    req.query as Record<string, string>,
    user,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notifications retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getUnreadCount = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;
  const result = await NotificationServices.getUnreadCount(user);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Unread count retrieved successfully",
    data: result,
  });
});

const markAsRead = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;
  const result = await NotificationServices.markAsRead(
    req.params.notificationId as string,
    user,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notification marked as read",
    data: result,
  });
});

const markAllAsRead = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;
  const result = await NotificationServices.markAllAsRead(user);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "All notifications marked as read",
    data: result,
  });
});

const deleteNotification = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;
  const result = await NotificationServices.deleteNotification(
    req.params.notificationId as string,
    user,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notification deleted successfully",
    data: result,
  });
});

const clearReadNotifications = catchAsync(
  async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const result = await NotificationServices.clearReadNotifications(user);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Read notifications cleared",
      data: result,
    });
  },
);

export const NotificationController = {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearReadNotifications,
};
