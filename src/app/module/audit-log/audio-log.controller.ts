import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { IAuditLogQuery } from "./audit-log.interface";
import { AuditLogServices } from "./audit-log.service";

const getAllAuditLogs = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await AuditLogServices.getAllAuditLogs(
    req.query as unknown as IAuditLogQuery,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Audit logs retrieved successfully",
    data,
    meta,
  });
});

const getSingleAuditLog = catchAsync(async (req: Request, res: Response) => {
  const result = await AuditLogServices.getSingleAuditLog(
    req.params.auditLogId as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Audit log retrieved successfully",
    data: result,
  });
});

export const AuditLogController = {
  getAllAuditLogs,
  getSingleAuditLog,
};
