import ejs from "ejs";
import httpStatus from "http-status";
import path from "path";
import type { Prisma } from "../../../generated/prisma/client";
import { NotificationType } from "../../../generated/prisma/enums";
import config from "../../config";
import { transporter } from "../../lib/nodemailer";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { IRequestUser } from "../auth/auth.interface";
import type {
  INotificationQuery,
  INotifyInput,
  INotifyPayload,
} from "./notification.interface";

const MANAGEMENT_ROLES = ["MANAGER", "ADMIN"] as const;

const sendNotificationEmail = async (
  to: string,
  name: string,
  title: string,
  message: string,
) => {
  const templatePath = path.join(
    process.cwd(),
    "src/app/templates/notification.ejs",
  );
  const html = await ejs.renderFile(templatePath, {
    name,
    title,
    message,
    frontendUrl: config.frontend_url,
  });
  await transporter.sendMail({
    from: config.email_sender,
    to,
    subject: title,
    html,
  });
};

const notify = async (input: INotifyInput) => {
  try {
    if (input.dedupe && input.entityId) {
      const exists = await prisma.notification.findFirst({
        where: {
          userId: input.userId,
          type: input.type,
          entityId: input.entityId,
        },
        select: { id: true },
      });
      if (exists) return null;
    }

    const created = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        entityType: input.entityType,
        entityId: input.entityId,
      },
      include: {
        user: { select: { email: true, name: true, status: true } },
      },
    });

    if (input.sendEmail && created.user.status === "ACTIVE") {
      try {
        await sendNotificationEmail(
          created.user.email,
          created.user.name,
          input.title,
          input.message,
        );
        await prisma.notification.update({
          where: { id: created.id },
          data: { emailSent: true },
        });
      } catch (error) {
        // email fail holeo in-app notification thakbe
        console.error("[notification] email failed:", error);
      }
    }

    return created;
  } catch (error) {
    console.error("[notification] create failed:", error);
    return null;
  }
};

const notifyUsers = async (userIds: string[], payload: INotifyPayload) => {
  const unique = [...new Set(userIds.filter(Boolean))];
  await Promise.all(unique.map((userId) => notify({ ...payload, userId })));
};

const getManagementUserIds = async () => {
  const users = await prisma.user.findMany({
    where: {
      role: { in: [...MANAGEMENT_ROLES] },
      status: "ACTIVE",
      isDeleted: false,
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
};

const notifyManagement = async (payload: INotifyPayload) => {
  const ids = await getManagementUserIds();
  await notifyUsers(ids, payload);
};

const getMyNotifications = async (
  query: INotificationQuery,
  user: IRequestUser,
) => {
  const page = Math.max(Number.parseInt(query.page ?? "1", 10) || 1, 1);
  const limit = Math.min(
    Math.max(Number.parseInt(query.limit ?? "20", 10) || 20, 1),
    100,
  );
  const skip = (page - 1) * limit;

  const where: Prisma.NotificationWhereInput = { userId: user.userId };

  if (query.isRead === "true") where.isRead = true;
  if (query.isRead === "false") where.isRead = false;

  if (query.type) {
    const valid = Object.values(NotificationType) as string[];
    if (!valid.includes(query.type)) {
      throw new AppError(httpStatus.BAD_REQUEST, "Invalid notification type");
    }
    where.type = query.type as NotificationType;
  }

  const [data, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      take: limit,
      skip,
      orderBy: { createdAt: "desc" },
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

const getUnreadCount = async (user: IRequestUser) => {
  const count = await prisma.notification.count({
    where: { userId: user.userId, isRead: false },
  });
  return { unreadCount: count };
};

const markAsRead = async (notificationId: string, user: IRequestUser) => {
  const owned = await prisma.notification.findFirst({
    where: { id: notificationId, userId: user.userId },
    select: { id: true },
  });
  if (!owned) {
    throw new AppError(httpStatus.NOT_FOUND, "Notification Not Found");
  }

  await prisma.notification.updateMany({
    where: { id: notificationId, userId: user.userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });

  return prisma.notification.findUniqueOrThrow({
    where: { id: notificationId },
  });
};

const markAllAsRead = async (user: IRequestUser) => {
  const updated = await prisma.notification.updateMany({
    where: { userId: user.userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  return { updatedCount: updated.count };
};

const deleteNotification = async (
  notificationId: string,
  user: IRequestUser,
) => {
  const deleted = await prisma.notification.deleteMany({
    where: { id: notificationId, userId: user.userId },
  });
  if (deleted.count === 0) {
    throw new AppError(httpStatus.NOT_FOUND, "Notification Not Found");
  }
  return { deleted: true };
};

const clearReadNotifications = async (user: IRequestUser) => {
  const deleted = await prisma.notification.deleteMany({
    where: { userId: user.userId, isRead: true },
  });
  return { deletedCount: deleted.count };
};

export const NotificationServices = {
  notify,
  notifyUsers,
  notifyManagement,
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearReadNotifications,
};
