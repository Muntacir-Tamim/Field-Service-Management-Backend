import z from "zod";

export const CreateSkillZodSchema = z.object({
  name: z.string().trim().min(2, "Skill name is too short").max(60),
  category: z.string().trim().min(2, "Category is required").max(60),
  description: z.string().trim().max(300).optional(),
});

export const UpdateSkillZodSchema = z
  .object({
    name: z.string().trim().min(2).max(60).optional(),
    category: z.string().trim().min(2).max(60).optional(),
    description: z.string().trim().max(300).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "Provide at least one field to update",
  });
