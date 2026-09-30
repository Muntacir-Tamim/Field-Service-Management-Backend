import z from "zod";

const passwordRule = z
  .string()
  .min(8, "Password Must Minimum 8 Characters Long.")
  .regex(/[a-z]/, "Password must contain atleast 1 Lowercase Letter")
  .regex(/[A-Z]/, "Password must contain atleast 1 Uppercase Letter")
  .regex(/[0-9]/, "Password must contain atleast 1 Number")
  .regex(/[^A-Za-z0-9]/, "Password must contain atleast 1 Special Character");

const skillLevel = z.enum(["BEGINNER", "INTERMEDIATE", "EXPERT"]);

// The apply form is multipart, so this schema is run on JSON.parse(req.body.data)
export const ApplyAsTechnicianZodSchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters").max(50),
  email: z.email("Not a valid email"),
  password: passwordRule,
  technician: z.object({
    contactNumber: z
      .string()
      .trim()
      .min(6, "Contact number is required")
      .max(20),
    gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
    address: z.string().trim().max(200).optional(),
    bio: z.string().trim().max(500).optional(),
    experienceYears: z.number().int().min(0).max(60),
  }),
  skills: z
    .array(
      z.object({ skillId: z.string().min(1), level: skillLevel.optional() }),
    )
    .min(1, "Select at least 1 skill")
    .max(15, "You can select at most 15 skills")
    .refine((arr) => new Set(arr.map((s) => s.skillId)).size === arr.length, {
      message: "Duplicate skills are not allowed",
    }),
});

export const VerifyTechnicianEmailZodSchema = z.object({
  email: z.email("Not a valid email"),
  otp: z.string().length(6, "OTP must be 6 digits"),
});

export const ResendOtpZodSchema = z.object({
  email: z.email("Not a valid email"),
});

export const ReviewTechnicianZodSchema = z
  .object({
    verificationStatus: z.enum(["APPROVED", "REJECTED"]),
    rejectionReason: z.string().trim().max(300).optional(),
  })
  .refine(
    (d) =>
      d.verificationStatus !== "REJECTED" ||
      (d.rejectionReason && d.rejectionReason.length >= 5),
    {
      message: "Rejection reason (min 5 characters) is required when rejecting",
      path: ["rejectionReason"],
    },
  );

export const UpdateTechnicianProfileZodSchema = z
  .object({
    contactNumber: z.string().trim().min(6).max(20).optional(),
    gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
    address: z.string().trim().max(200).optional(),
    bio: z.string().trim().max(500).optional(),
    experienceYears: z.number().int().min(0).max(60).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "Provide at least one field to update",
  });

export const UpdateAvailabilityZodSchema = z.object({
  isAvailable: z.boolean("isAvailable must be true or false"),
});

export const AddSkillZodSchema = z.object({
  skillId: z.string().min(1, "skillId is required"),
  level: skillLevel.optional(),
});
