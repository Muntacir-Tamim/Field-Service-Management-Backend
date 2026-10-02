import z from "zod";

export const CreateFeedbackZodSchema = z.object({
  serviceRequestId: z.string().trim().min(1, "Service request id is required"),
  rating: z.coerce
    .number({ error: "Rating must be a number between 1 and 5" })
    .int("Rating must be a whole number")
    .min(1, "Rating must be at least 1")
    .max(5, "Rating must be at most 5"),
  comment: z.string().trim().max(1000, "Comment is too long").optional(),
});

export const UpdateFeedbackZodSchema = z
  .object({
    rating: z.coerce
      .number({ error: "Rating must be a number between 1 and 5" })
      .int("Rating must be a whole number")
      .min(1, "Rating must be at least 1")
      .max(5, "Rating must be at most 5")
      .optional(),
    comment: z.string().trim().max(1000, "Comment is too long").optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "Provide at least one field to update",
  });
