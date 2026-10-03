import cron from "node-cron";
import { prisma } from "../lib/prisma";
import { NotificationEvents } from "../module/notification/notification.events";

const REMINDER_WINDOW_MINUTES = 60; // visit shuru hobar koto age reminder
let running = false; // ager run sesh na hole notun run shuru hobe na

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

    // dedupe NotificationEvents.visitReminder-er bhitore-i ache
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
  // proti 10 minute-e ekbar
  cron.schedule("*/10 * * * *", runVisitReminders);
  console.log("Visit reminder job started (every 10 minutes).");
};
