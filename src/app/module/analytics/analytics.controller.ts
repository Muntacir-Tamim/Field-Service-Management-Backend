import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type { IRequestUser } from "../auth/auth.interface";
import type { IAnalyticsQuery } from "./analytics.interface";
import { AnalyticsServices } from "./analytics.service";

const getMyStats = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;
  const result = await AnalyticsServices.getMyStats(
    req.query as IAnalyticsQuery,
    user,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Your analytics fetched successfully",
    data: result,
  });
});

const getSingleTechnicianStats = catchAsync(
  async (req: Request, res: Response) => {
    const result = await AnalyticsServices.getSingleTechnicianStats(
      req.params.technicianId as string,
      req.query as IAnalyticsQuery,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Technician analytics fetched successfully",
      data: result,
    });
  },
);

const getTechnicianLeaderboard = catchAsync(
  async (req: Request, res: Response) => {
    const result = await AnalyticsServices.getTechnicianLeaderboard(
      req.query as IAnalyticsQuery,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Technician leaderboard fetched successfully",
      data: result,
    });
  },
);

const getDashboardStats = catchAsync(async (req: Request, res: Response) => {
  const result = await AnalyticsServices.getDashboardStats(
    req.query as IAnalyticsQuery,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Dashboard stats fetched successfully",
    data: result,
  });
});

export const AnalyticsController = {
  getMyStats,
  getSingleTechnicianStats,
  getTechnicianLeaderboard,
  getDashboardStats,
};
