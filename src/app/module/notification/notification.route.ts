import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { NotificationController } from "./notification.controller";

const router = Router();

// shob logged-in role eta use korte pare
const ALL_ROLES = Object.values(Role) as Role[];

// GET /api/v1/notifications?isRead=false&type=INVOICE_CREATED&page=1&limit=20
router.get("/", auth(...ALL_ROLES), NotificationController.getMyNotifications);

// GET /api/v1/notifications/unread-count   (navbar badge-er jonno)
router.get(
  "/unread-count",
  auth(...ALL_ROLES),
  NotificationController.getUnreadCount,
);

// PATCH /api/v1/notifications/read-all
router.patch(
  "/read-all",
  auth(...ALL_ROLES),
  NotificationController.markAllAsRead,
);

// DELETE /api/v1/notifications/clear-read
router.delete(
  "/clear-read",
  auth(...ALL_ROLES),
  NotificationController.clearReadNotifications,
);

// ── "/:notificationId" shobar sheshe ─────────────────
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
