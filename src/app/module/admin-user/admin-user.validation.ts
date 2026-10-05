import z from "zod";

// GET /admin/users  (query params)
export const GetUsersQueryZodSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  searchTerm: z.string().trim().max(100).optional(),
  role: z.enum(["CUSTOMER", "TECHNICIAN", "ADMIN"]).optional(),
  status: z.enum(["ACTIVE", "BLOCKED", "DELETED"]).optional(),
  sortBy: z.enum(["createdAt", "name", "email"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// PATCH /admin/users/:userId/status  (body)
export const UpdateUserStatusZodSchema = z
  .object({
    status: z.enum(["ACTIVE", "BLOCKED"], {
      error: "Status must be ACTIVE or BLOCKED",
    }),
    reason: z.string().trim().min(5).max(300).optional(),
  })
  .refine((d) => d.status !== "BLOCKED" || !!d.reason, {
    message: "Reason (min 5 characters) is required when blocking a user",
    path: ["reason"],
  });
