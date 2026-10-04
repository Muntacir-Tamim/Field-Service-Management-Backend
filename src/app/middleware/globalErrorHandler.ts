// import type { NextFunction, Request, Response } from "express";
// import httpStatus from "http-status";
// import { Prisma } from "../../generated/prisma/client";
// import config from "../config";

// // eslint-disable-next-line @typescript-eslint/no-explicit-any
// export const globalErrorHandler = async (
// 	err: any,
// 	_req: Request,
// 	res: Response,
// 	_next: NextFunction,
// ) => {
// 	if (config.node_env === "development") {
// 		console.log("Error from Global Error Handler", err);
// 	}

// 	let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR;
// 	let errorMessage = err.message || "Internal Server Error";
// 	const errorName = err.name || "Internal Server Error";
// 	// let errorDetails = err.stack

// 	if (err instanceof Prisma.PrismaClientValidationError) {
// 		statusCode = httpStatus.BAD_REQUEST;
// 		errorMessage = "You have provided incorrect field type or missing fields";
// 	} else if (err instanceof Prisma.PrismaClientKnownRequestError) {
// 		if (err.code === "P2002") {
// 			(statusCode = httpStatus.BAD_REQUEST),
// 				(errorMessage = "Duplicate Key Error");
// 		} else if (err.code === "P2003") {
// 			(statusCode = httpStatus.BAD_REQUEST),
// 				(errorMessage = "Foreign key constraint failed");
// 		} else if (err.code === "P2025") {
// 			(statusCode = httpStatus.BAD_REQUEST),
// 				(errorMessage =
// 					"An operation failed because it depends on one or more records that were required but not found.");
// 		}
// 	} else if (err instanceof Prisma.PrismaClientInitializationError) {
// 		if (err.errorCode === "P1000") {
// 			statusCode = httpStatus.UNAUTHORIZED;
// 			errorMessage =
// 				"Authentication failed against database server. Please Check Your Credentials";
// 		} else if (err.errorCode === "P1001") {
// 			statusCode = httpStatus.BAD_REQUEST;
// 			errorMessage = "Can't reach database server";
// 		}
// 	} else if (err instanceof Prisma.PrismaClientUnknownRequestError) {
// 		statusCode = httpStatus.INTERNAL_SERVER_ERROR;
// 		errorMessage = "Error occurred during query execution";
// 	} else if (err instanceof Error) {
// 		errorMessage = err.message;
// 	}

// 	res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
// 		success: false,
// 		statusCode: statusCode || httpStatus.INTERNAL_SERVER_ERROR,
// 		name:
// 			config.node_env === "development" ? errorName : "Internal Server Error",
// 		message:
// 			config.node_env === "development"
// 				? errorMessage
// 				: "Internal Server Error",
// 		error: config.node_env === "development" ? err : undefined,
// 		stack: config.node_env === "development" ? err.stack : undefined,
// 	});
// };

import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { Prisma } from "../../generated/prisma/client";
import config from "../config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const globalErrorHandler = (
  err: any,
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (res.headersSent) {
    return next(err);
  }

  if (config.node_env === "development") {
    console.error("Error from Global Error Handler", err);
  }

  let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR;
  let errorMessage = "Internal Server Error";
  const errorName = err?.name || "Internal Server Error";

  if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = httpStatus.BAD_REQUEST;
    errorMessage = "You have provided incorrect field type or missing fields";
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      statusCode = httpStatus.CONFLICT;
      errorMessage = "Duplicate Key Error";
    } else if (err.code === "P2003") {
      statusCode = httpStatus.BAD_REQUEST;
      errorMessage = "Foreign key constraint failed";
    } else if (err.code === "P2025") {
      statusCode = httpStatus.NOT_FOUND;
      errorMessage = "Record not found";
    }
  } else if (err instanceof Prisma.PrismaClientInitializationError) {
    if (err.errorCode === "P1000") {
      statusCode = httpStatus.INTERNAL_SERVER_ERROR;
      errorMessage = "Database authentication failed";
    } else if (err.errorCode === "P1001") {
      statusCode = httpStatus.INTERNAL_SERVER_ERROR;
      errorMessage = "Can't reach database server";
    }
  } else if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    errorMessage = "Error occurred during query execution";
  } else if (
    typeof err?.status === "number" &&
    err.status >= 400 &&
    err.status < 500
  ) {
    statusCode = err.status;
    errorMessage = err.message || "Bad Request";
  } else if (err instanceof Error) {
    errorMessage = err.message;
  }

  res.status(statusCode).json({
    success: false,
    statusCode,
    name:
      config.node_env === "development" ? errorName : "Internal Server Error",
    message:
      config.node_env === "development"
        ? errorMessage
        : "Internal Server Error",
    error: config.node_env === "development" ? err : undefined,
    stack: config.node_env === "development" ? err.stack : undefined,
  });
};
