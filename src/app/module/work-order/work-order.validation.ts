import z from "zod";

// NOTE: complete + add-part may arrive as multipart/form-data,
// so numbers are coerced from strings.

export const StartWorkZodSchema = z.object({
  problemFound: z
    .string()
    .min(3, "problemFound is required (min 3 characters)")
    .max(1000),
  workDescription: z
    .string()
    .min(3, "workDescription is required (min 3 characters)")
    .max(2000),
});

export const CompleteWorkZodSchema = z.object({
  laborHours: z.coerce
    .number({ message: "laborHours must be a number" })
    .positive("laborHours must be greater than 0")
    .max(100, "laborHours looks too large (max 100)"),
  completionNotes: z
    .string()
    .min(3, "completionNotes is required (min 3 characters)")
    .max(2000),
});

export const AddPartZodSchema = z.object({
  name: z.string().min(1, "Part name is required").max(150),
  quantity: z.coerce
    .number({ message: "quantity must be a number" })
    .int("quantity must be a whole number")
    .min(1, "quantity must be at least 1")
    .max(10000)
    .default(1),
  unitCost: z.coerce
    .number({ message: "unitCost must be a number" })
    .min(0, "unitCost cannot be negative")
    .max(99999999, "unitCost is too large"),
  notes: z.string().max(300).optional(),
});

export const ServiceReportZodSchema = z.object({
  summary: z
    .string()
    .min(5, "summary is required (min 5 characters)")
    .max(1000),
  findings: z
    .string()
    .min(5, "findings is required (min 5 characters)")
    .max(3000),
  recommendations: z.string().max(2000).optional(),
});
