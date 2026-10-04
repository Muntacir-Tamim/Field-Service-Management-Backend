// import type { NextFunction, Request, Response } from "express";
// import httpStatus from "http-status";
// import { Prisma } from "../../generated/prisma/client";
// import config from "../config";
// import { AppError } from "../utils/AppError";

// export const globalErrorHandler = async (
//   err: any,
//   _req: Request,
//   res: Response,
//   _next: NextFunction,
// ) => {
//   if (config.node_env === "development") {
//     console.log("Error from Global Error Handler", err);
//   }

//   let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR;
//   let errorMessage = err.message || "Internal Server Error";
//   const errorName = err.name || "Internal Server Error";

//   if (err instanceof Prisma.PrismaClientValidationError) {
//     statusCode = httpStatus.BAD_REQUEST;
//     errorMessage = "You have provided incorrect field type or missing fields";
//   } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
//     if (err.code === "P2002") {
//       statusCode = httpStatus.BAD_REQUEST;
//       errorMessage = "Duplicate Key Error";
//     } else if (err.code === "P2003") {
//       statusCode = httpStatus.BAD_REQUEST;
//       errorMessage = "Foreign key constraint failed";
//     } else if (err.code === "P2025") {
//       statusCode = httpStatus.BAD_REQUEST;
//       errorMessage =
//         "An operation failed because it depends on one or more records that were required but not found.";
//     }
//   } else if (err instanceof Prisma.PrismaClientInitializationError) {
//     if (err.errorCode === "P1000") {
//       statusCode = httpStatus.UNAUTHORIZED;
//       errorMessage =
//         "Authentication failed against database server. Please Check Your Credentials";
//     } else if (err.errorCode === "P1001") {
//       statusCode = httpStatus.BAD_REQUEST;
//       errorMessage = "Can't reach database server";
//     }
//   } else if (err instanceof Prisma.PrismaClientUnknownRequestError) {
//     statusCode = httpStatus.INTERNAL_SERVER_ERROR;
//     errorMessage = "Error occurred during query execution";
//   } else if (err instanceof AppError) {
//     errorMessage = err.message;
//     statusCode = err.statusCode;
//   } else if (err instanceof Error) {
//     errorMessage = err.message;
//   }

//   res.status(statusCode).json({
//     success: false,
//     statusCode: statusCode,
//     name:
//       config.node_env === "development" ? errorName : "Internal Server Error",
//     message:
//       config.node_env === "development"
//         ? errorMessage
//         : "Internal Server Error",
//     error: config.node_env === "development" ? err : undefined,
//     stack: config.node_env === "development" ? err.stack : undefined,
//   });
// };

import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { ZodError } from "zod";
import { Prisma } from "../../generated/prisma/client";
import config from "../config";
import { AppError } from "../utils/AppError";

type TErrorSource = { field?: string; message: string };

export const globalErrorHandler = async (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const isDev = config.node_env === "development";

  if (isDev) {
    console.log("Error from Global Error Handler", err);
  }

  let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR;
  let message = "Internal Server Error";
  let errors: TErrorSource[] = [];

  if (err instanceof ZodError) {
    statusCode = httpStatus.BAD_REQUEST;
    message = "Validation failed";
    errors = err.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = httpStatus.BAD_REQUEST;
    message = "You have provided incorrect field type or missing fields";
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      statusCode = httpStatus.CONFLICT;
      message = "Duplicate Key Error";
    } else if (err.code === "P2003") {
      statusCode = httpStatus.BAD_REQUEST;
      message = "Foreign key constraint failed";
    } else if (err.code === "P2025") {
      statusCode = httpStatus.NOT_FOUND;
      message = "Required record not found";
    }
  } else if (err instanceof Prisma.PrismaClientInitializationError) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    message = "Database connection failed";
  } else if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    message = "Error occurred during query execution";
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof Error && isDev) {
    message = err.message;
  }

  if (errors.length === 0) {
    errors = [{ message }];
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors,
    ...(isDev && { stack: err.stack }),
  });
};
