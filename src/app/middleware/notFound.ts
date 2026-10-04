// import type { Request, Response } from "express";
// import httpStatus from "http-status";

// export const notFound = (req: Request, res: Response) => {
// 	res.status(httpStatus.NOT_FOUND).json({
// 		message: "Route not found",
// 		path: req.originalUrl,
// 		date: new Date(),
// 	});
// };

import type { Request, Response } from "express";
import httpStatus from "http-status";

export const notFound = (req: Request, res: Response) => {
  res.status(httpStatus.NOT_FOUND).json({
    success: false,
    message: "Route not found",
    errors: [
      { field: "path", message: `Cannot ${req.method} ${req.originalUrl}` },
    ],
  });
};
