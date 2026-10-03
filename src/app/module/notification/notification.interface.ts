import type { NotificationType } from "../../../generated/prisma/enums";

export interface INotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  /** true => email-o pathabe (default false: shudhu in-app) */
  sendEmail?: boolean;
  /** true => same user + type + entityId age thakle abar create korbe na */
  dedupe?: boolean;
}

export type INotifyPayload = Omit<INotifyInput, "userId">;

export interface INotificationQuery {
  page?: string;
  limit?: string;
  isRead?: string; // "true" | "false"
  type?: string;
}
