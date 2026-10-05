import type z from "zod";
import type {
  GetUsersQueryZodSchema,
  UpdateUserStatusZodSchema,
} from "./admin-user.validation";

export type IGetUsersQuery = z.infer<typeof GetUsersQueryZodSchema>;
export type IUpdateUserStatusPayload = z.infer<
  typeof UpdateUserStatusZodSchema
>;
