import z from "zod";

export const CreateInvoiceZodSchema = z.object({
  workOrderId: z.string().min(1, "workOrderId is required"),
  discount: z.coerce
    .number({ message: "discount must be a number" })
    .min(0, "discount cannot be negative")
    .max(99999999)
    .optional(),
  taxPercent: z.coerce
    .number({ message: "taxPercent must be a number" })
    .min(0, "taxPercent cannot be negative")
    .max(100, "taxPercent cannot be more than 100")
    .optional(),
  dueDate: z.coerce
    .date({ message: "dueDate must be a valid date" })
    .optional(),
  notes: z.string().max(500).optional(),
});

export const InitiatePaymentZodSchema = z.object({
  paymentId: z.string().min(1, "paymentId is required"),
});

export const RefundZodSchema = z.object({
  reason: z
    .string()
    .min(3, "Refund reason is required (min 3 characters)")
    .max(300),
});
