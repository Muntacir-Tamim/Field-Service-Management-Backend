import cookieParser from "cookie-parser";
import cors from "cors";
import crypto from "crypto";
import express, {
  type Application,
  NextFunction,
  type Request,
  type Response,
} from "express";
import httpStatus from "http-status";
import config from "./app/config";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { AuthRoutes } from "./app/module/auth/auth.route";
import { UserRoutes } from "./app/module/user/user.route";

import { ServiceRequestRoutes } from "./app/module/service-request/service-request.route";
import { AssignmentRoutes } from "./app/module/assignment/Assignment.route";
import { TechnicianRoutes } from "./app/module/technician/Technician.route";
import { SkillRoutes } from "./app/module/skill/Skill.route";
import { WorkOrderRoutes } from "./app/module/work-order/work-order.route";
import { PaymentRoutes } from "./app/module/payment/payment.route";
import { FeedbackRoutes } from "./app/module/feedback/feedback.route";
import { NotificationRoutes } from "./app/module/notification/notification.route";
import { AnalyticsRoutes } from "./app/module/analytics/analytics.route";

const app: Application = express();

app.use(
  cors({
    origin: config.frontend_url,
    credentials: true,
  }),
);

// Enable URL-encoded form data parsing
app.use(express.urlencoded({ extended: true }));

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cookieParser());

app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1/user", UserRoutes);
app.use("/api/v1/service-requests", ServiceRequestRoutes);
app.use("/api/v1/payment", PaymentRoutes);
app.use("/api/v1/assignments", AssignmentRoutes);
app.use("/api/v1/technicians", TechnicianRoutes);
app.use("/api/v1/skills", SkillRoutes);
app.use("/api/v1/work-orders", WorkOrderRoutes);
app.use("/api/v1/feedbacks", FeedbackRoutes);
app.use("/api/v1/notifications", NotificationRoutes);
app.use("/api/v1/analytics", AnalyticsRoutes);

app.get("/", async (req: Request, res: Response) => {
  res.status(httpStatus.OK).json({
    success: true,
    message: "Welcome to Field Service Management System Backend",
  });
});

app.use(notFound);
app.use(globalErrorHandler);

export default app;
