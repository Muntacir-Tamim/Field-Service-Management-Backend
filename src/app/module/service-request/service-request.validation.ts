import z from "zod";

export const CreateServiceRequestZodSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  preferredDate: z.string().optional(),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
});

export const ReviewServiceRequestZodSchema = z
  .object({
    status: z.enum(["APPROVED", "REJECTED"], {
      message: "Status must be either APPROVED or REJECTED",
    }),
    rejectionReason: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.status === "REJECTED" && !data.rejectionReason) {
        return false;
      }
      return true;
    },
    {
      message: "Rejection reason is required when rejecting a request",
      path: ["rejectionReason"],
    },
  );
