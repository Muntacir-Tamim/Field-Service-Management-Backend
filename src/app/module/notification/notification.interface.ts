import type { NotificationType } from "../../../generated/prisma/enums";

export interface INotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  sendEmail?: boolean;
  dedupe?: boolean;
}

export type INotifyPayload = Omit<INotifyInput, "userId">;

export interface INotificationQuery {
  page?: string;
  limit?: string;
  isRead?: string;
  type?: string;
}
