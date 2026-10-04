// import type { Request, Response } from "express";
// import httpStatus from "http-status";
// import { AppError } from "../../utils/AppError";
// import { catchAsync } from "../../utils/catchAsync";
// import { sendResponse } from "../../utils/sendResponse";
// import type { IRequestUser } from "../auth/auth.interface";

// import { TechnicianServices } from "./Technician.service";
// import { ApplyAsTechnicianZodSchema } from "./Technician.validation";

// const applyAsTechnician = catchAsync(async (req: Request, res: Response) => {
//   const files = req.files as
//     | { [field: string]: Express.Multer.File[] }
//     | undefined;
//   const resume = files?.resume?.[0] ?? null;
//   const documents = files?.documents ?? [];

//   let raw: unknown;
//   try {
//     raw = JSON.parse(req.body?.data ?? "");
//   } catch {
//     throw new AppError(
//       httpStatus.BAD_REQUEST,
//       'Form field "data" must contain valid JSON',
//     );
//   }

//   const parsed = ApplyAsTechnicianZodSchema.safeParse(raw);
//   if (!parsed.success) {
//     throw new AppError(httpStatus.BAD_REQUEST, parsed.error.issues[0].message);
//   }

//   const result = await TechnicianServices.applyAsTechnician(
//     parsed.data,
//     resume,
//     documents,
//   );

//   sendResponse(res, {
//     statusCode: httpStatus.CREATED,
//     success: true,
//     message:
//       "Application submitted. Please check your email for the verification OTP.",
//     data: result,
//   });
// });

// const verifyTechnicianEmail = catchAsync(
//   async (req: Request, res: Response) => {
//     const result = await TechnicianServices.verifyTechnicianEmail(req.body);
//     sendResponse(res, {
//       statusCode: httpStatus.OK,
//       success: true,
//       message: "Email verified. Your application is now waiting for review.",
//       data: result,
//     });
//   },
// );

// const resendApplicationOtp = catchAsync(async (req: Request, res: Response) => {
//   await TechnicianServices.resendApplicationOtp(req.body);
//   sendResponse(res, {
//     statusCode: httpStatus.OK,
//     success: true,
//     message: "A new OTP has been sent to your email",
//     data: null,
//   });
// });

// const reviewTechnician = catchAsync(async (req: Request, res: Response) => {
//   const result = await TechnicianServices.reviewTechnician(
//     req.params.technicianId as string,
//     req.body,
//     req.user as IRequestUser,
//   );
//   sendResponse(res, {
//     statusCode: httpStatus.OK,
//     success: true,
//     message: `Technician application ${result.verificationStatus.toLowerCase()} successfully`,
//     data: result,
//   });
// });

// const getAllTechnicians = catchAsync(async (req: Request, res: Response) => {
//   const { data, meta } = await TechnicianServices.getAllTechnicians(req.query);
//   sendResponse(res, {
//     statusCode: httpStatus.OK,
//     success: true,
//     message: "Technicians retrieved successfully",
//     data,
//     meta,
//   });
// });

// const getSingleTechnician = catchAsync(async (req: Request, res: Response) => {
//   const result = await TechnicianServices.getSingleTechnician(
//     req.params.technicianId as string,
//   );
//   sendResponse(res, {
//     statusCode: httpStatus.OK,
//     success: true,
//     message: "Technician retrieved successfully",
//     data: result,
//   });
// });

// const getMyProfile = catchAsync(async (req: Request, res: Response) => {
//   const result = await TechnicianServices.getMyProfile(
//     req.user as IRequestUser,
//   );
//   sendResponse(res, {
//     statusCode: httpStatus.OK,
//     success: true,
//     message: "Profile retrieved successfully",
//     data: result,
//   });
// });

// const updateMyProfile = catchAsync(async (req: Request, res: Response) => {
//   const result = await TechnicianServices.updateMyProfile(
//     req.user as IRequestUser,
//     req.body,
//   );
//   sendResponse(res, {
//     statusCode: httpStatus.OK,
//     success: true,
//     message: "Profile updated successfully",
//     data: result,
//   });
// });

// const updateMyAvailability = catchAsync(async (req: Request, res: Response) => {
//   const result = await TechnicianServices.updateMyAvailability(
//     req.user as IRequestUser,
//     req.body.isAvailable,
//   );
//   sendResponse(res, {
//     statusCode: httpStatus.OK,
//     success: true,
//     message: `You are now marked as ${result.isAvailable ? "available" : "unavailable"}`,
//     data: result,
//   });
// });

// const addMySkill = catchAsync(async (req: Request, res: Response) => {
//   const result = await TechnicianServices.addMySkill(
//     req.user as IRequestUser,
//     req.body,
//   );
//   sendResponse(res, {
//     statusCode: httpStatus.OK,
//     success: true,
//     message: "Skill saved successfully",
//     data: result,
//   });
// });

// const removeMySkill = catchAsync(async (req: Request, res: Response) => {
//   const result = await TechnicianServices.removeMySkill(
//     req.user as IRequestUser,
//     req.params.skillId as string,
//   );
//   sendResponse(res, {
//     statusCode: httpStatus.OK,
//     success: true,
//     message: "Skill removed successfully",
//     data: result,
//   });
// });

// export const TechnicianController = {
//   applyAsTechnician,
//   verifyTechnicianEmail,
//   resendApplicationOtp,
//   reviewTechnician,
//   getAllTechnicians,
//   getSingleTechnician,
//   getMyProfile,
//   updateMyProfile,
//   updateMyAvailability,
//   addMySkill,
//   removeMySkill,
// };

import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type { IRequestUser } from "../auth/auth.interface";

import { TechnicianServices } from "./Technician.service";
import { ApplyAsTechnicianZodSchema } from "./Technician.validation";

const applyAsTechnician = catchAsync(async (req: Request, res: Response) => {
  const files = req.files as
    | { [field: string]: Express.Multer.File[] }
    | undefined;
  const resume = files?.resume?.[0] ?? null;
  const documents = files?.documents ?? [];

  let raw: unknown;
  try {
    raw = JSON.parse(req.body?.data ?? "");
  } catch {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Form field "data" must contain valid JSON',
    );
  }

  const parsed = ApplyAsTechnicianZodSchema.safeParse(raw);
  if (!parsed.success) {
    throw parsed.error;
  }

  const result = await TechnicianServices.applyAsTechnician(
    parsed.data,
    resume,
    documents,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message:
      "Application submitted. Please check your email for the verification OTP.",
    data: result,
  });
});

const verifyTechnicianEmail = catchAsync(
  async (req: Request, res: Response) => {
    const result = await TechnicianServices.verifyTechnicianEmail(req.body);
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Email verified. Your application is now waiting for review.",
      data: result,
    });
  },
);

const resendApplicationOtp = catchAsync(async (req: Request, res: Response) => {
  await TechnicianServices.resendApplicationOtp(req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "A new OTP has been sent to your email",
    data: null,
  });
});

const reviewTechnician = catchAsync(async (req: Request, res: Response) => {
  const result = await TechnicianServices.reviewTechnician(
    req.params.technicianId as string,
    req.body,
    req.user as IRequestUser,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Technician application ${result.verificationStatus.toLowerCase()} successfully`,
    data: result,
  });
});

const getAllTechnicians = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await TechnicianServices.getAllTechnicians(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Technicians retrieved successfully",
    data,
    meta,
  });
});

const getSingleTechnician = catchAsync(async (req: Request, res: Response) => {
  const result = await TechnicianServices.getSingleTechnician(
    req.params.technicianId as string,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Technician retrieved successfully",
    data: result,
  });
});

const getMyProfile = catchAsync(async (req: Request, res: Response) => {
  const result = await TechnicianServices.getMyProfile(
    req.user as IRequestUser,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile retrieved successfully",
    data: result,
  });
});

const updateMyProfile = catchAsync(async (req: Request, res: Response) => {
  const result = await TechnicianServices.updateMyProfile(
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

const updateMyAvailability = catchAsync(async (req: Request, res: Response) => {
  const result = await TechnicianServices.updateMyAvailability(
    req.user as IRequestUser,
    req.body.isAvailable,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `You are now marked as ${result.isAvailable ? "available" : "unavailable"}`,
    data: result,
  });
});

const addMySkill = catchAsync(async (req: Request, res: Response) => {
  const result = await TechnicianServices.addMySkill(
    req.user as IRequestUser,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Skill saved successfully",
    data: result,
  });
});

const removeMySkill = catchAsync(async (req: Request, res: Response) => {
  const result = await TechnicianServices.removeMySkill(
    req.user as IRequestUser,
    req.params.skillId as string,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Skill removed successfully",
    data: result,
  });
});

export const TechnicianController = {
  applyAsTechnician,
  verifyTechnicianEmail,
  resendApplicationOtp,
  reviewTechnician,
  getAllTechnicians,
  getSingleTechnician,
  getMyProfile,
  updateMyProfile,
  updateMyAvailability,
  addMySkill,
  removeMySkill,
};
