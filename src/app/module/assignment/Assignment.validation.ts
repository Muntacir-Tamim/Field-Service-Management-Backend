import z from "zod";

const dateField = (label: string) =>
  z.coerce.date({ message: `${label} must be a valid date` });

export const CreateAssignmentZodSchema = z
  .object({
    serviceRequestId: z.string().min(1, "serviceRequestId is required"),
    technicianId: z.string().min(1, "technicianId is required"),
    scheduledStart: dateField("scheduledStart"),
    scheduledEnd: dateField("scheduledEnd"),
    notes: z.string().max(500).optional(),
  })
  .refine((d) => d.scheduledEnd > d.scheduledStart, {
    message: "scheduledEnd must be after scheduledStart",
    path: ["scheduledEnd"],
  });

export const RescheduleAssignmentZodSchema = z
  .object({
    scheduledStart: dateField("scheduledStart"),
    scheduledEnd: dateField("scheduledEnd"),
    technicianId: z.string().min(1).optional(),
    reason: z.string().max(300).optional(),
    notes: z.string().max(500).optional(),
  })
  .refine((d) => d.scheduledEnd > d.scheduledStart, {
    message: "scheduledEnd must be after scheduledStart",
    path: ["scheduledEnd"],
  });

export const CancelAssignmentZodSchema = z.object({
  reason: z
    .string()
    .min(3, "Cancel reason is required (min 3 characters)")
    .max(300),
});
