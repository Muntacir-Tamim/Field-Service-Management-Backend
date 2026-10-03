import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { NotificationController } from "./notification.controller";

const router = Router();

const ALL_ROLES = Object.values(Role) as Role[];

router.get("/", auth(...ALL_ROLES), NotificationController.getMyNotifications);

router.get(
  "/unread-count",
  auth(...ALL_ROLES),
  NotificationController.getUnreadCount,
);

router.patch(
  "/read-all",
  auth(...ALL_ROLES),
  NotificationController.markAllAsRead,
);

router.delete(
  "/clear-read",
  auth(...ALL_ROLES),
  NotificationController.clearReadNotifications,
);

router.patch(
  "/:notificationId/read",
  auth(...ALL_ROLES),
  NotificationController.markAsRead,
);

router.delete(
  "/:notificationId",
  auth(...ALL_ROLES),
  NotificationController.deleteNotification,
);

export const NotificationRoutes = router;
