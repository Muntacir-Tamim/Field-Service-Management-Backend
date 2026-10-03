import cron from "node-cron";
import { prisma } from "../lib/prisma";
import { NotificationEvents } from "../module/notification/notification.events";

const REMINDER_WINDOW_MINUTES = 60;
let running = false;

const runVisitReminders = async () => {
  if (running) return;
  running = true;

  try {
    const now = new Date();
    const windowEnd = new Date(
      now.getTime() + REMINDER_WINDOW_MINUTES * 60 * 1000,
    );

    const upcoming = await prisma.assignment.findMany({
      where: {
        status: "CONFIRMED",
        scheduledStart: { gt: now, lte: windowEnd },
        workOrder: { status: "SCHEDULED" },
      },
      select: { id: true },
    });

    for (const a of upcoming) {
      await NotificationEvents.visitReminder(a.id);
    }
  } catch (error) {
    console.error("[visitReminder] job failed:", error);
  } finally {
    running = false;
  }
};

export const startVisitReminderJob = () => {
  cron.schedule("*/10 * * * *", runVisitReminders);
  console.log("Visit reminder job started (every 10 minutes).");
};
