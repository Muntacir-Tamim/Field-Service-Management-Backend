// import type { NextFunction, Request, Response } from "express";
// import type z from "zod";
// import { catchAsync } from "../utils/catchAsync";

// export const validateRequest = (zodSchema: z.ZodObject) => {
// 	return catchAsync((req: Request, res: Response, next: NextFunction) => {
// 		// const payload = req.body ? req.body : {}
// 		const payload = req.body ?? {};

// 		const result = zodSchema.safeParse(payload);

// 		if (!result.success) {
// 			console.log(result.error);
// 			console.log(result.error.issues);

// 			throw new Error(result.error.issues[0].message);
// 		}

// 		req.body = result.data;

// 		next();
// 	});
// };

import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import type z from "zod";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";

export const validateRequest = (zodSchema: z.ZodObject) => {
  return catchAsync((req: Request, _res: Response, next: NextFunction) => {
    const result = zodSchema.safeParse(req.body ?? {});

    if (!result.success) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        result.error.issues[0].message,
      );
    }

    req.body = result.data;
    next();
  });
};
