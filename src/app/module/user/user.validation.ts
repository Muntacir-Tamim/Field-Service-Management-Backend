import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import z from "zod";
import { Role } from "../../../generated/prisma/enums";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";

const name = z
  .string()
  .trim()
  .min(3, "Name must be at least 3 characters")
  .max(50, "Name must be at most 50 characters");

const contactNumber = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s-]{6,20}$/, "Contact number is not valid");

const gender = z.enum(["MALE", "FEMALE", "OTHER"]);

const hasAtLeastOneField = (data: object) => Object.keys(data).length > 0;
const atLeastOneFieldMessage = {
  message: "Provide at least one field to update",
};

// strictObject => email / role / status / password ityadi pathale reject hobe
export const UpdateCustomerProfileZodSchema = z
  .strictObject({
    name: name.optional(),
    contactNumber: contactNumber.optional(),
    gender: gender.optional(),
    address: z.string().trim().min(1).max(200).optional(),
    city: z.string().trim().min(1).max(100).optional(),
  })
  .refine(hasAtLeastOneField, atLeastOneFieldMessage);

export const UpdateTechnicianProfileViaMeZodSchema = z
  .strictObject({
    name: name.optional(),
    contactNumber: contactNumber.optional(),
    gender: gender.optional(),
    address: z.string().trim().min(1).max(200).optional(),
    bio: z.string().trim().max(500).optional(),
    experienceYears: z.number().int().min(0).max(60).optional(),
  })
  .refine(hasAtLeastOneField, atLeastOneFieldMessage);

export const UpdateAdminProfileZodSchema = z
  .strictObject({
    name: name.optional(),
    contactNumber: contactNumber.optional(),
    department: z.string().trim().min(1).max(100).optional(),
  })
  .refine(hasAtLeastOneField, atLeastOneFieldMessage);

const schemaByRole = {
  [Role.CUSTOMER]: UpdateCustomerProfileZodSchema,
  [Role.TECHNICIAN]: UpdateTechnicianProfileViaMeZodSchema,
  [Role.ADMIN]: UpdateAdminProfileZodSchema,
} as const;

// auth() middleware er pore boshbe: role onujayi alada schema diye validate kore
export const validateProfileUpdate = catchAsync(
  (req: Request, _res: Response, next: NextFunction) => {
    const role = req.user?.role;
    if (!role) {
      throw new AppError(httpStatus.UNAUTHORIZED, "You are not logged in.");
    }

    // ZodError throw hole globalErrorHandler 400 dey
    req.body = schemaByRole[role].parse(req.body ?? {});
    next();
  },
);
