-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SERVICE_REQUEST_CREATED', 'SERVICE_REQUEST_UNDER_REVIEW', 'SERVICE_REQUEST_APPROVED', 'SERVICE_REQUEST_REJECTED', 'SERVICE_REQUEST_CANCELLED', 'ASSIGNMENT_CREATED', 'ASSIGNMENT_CONFIRMED', 'ASSIGNMENT_CANCELLED', 'ASSIGNMENT_RESCHEDULED', 'VISIT_REMINDER', 'TECHNICIAN_EN_ROUTE', 'TECHNICIAN_ARRIVED', 'WORK_STARTED', 'WORK_COMPLETED', 'WORK_VERIFIED', 'INVOICE_CREATED', 'PAYMENT_RECEIVED', 'PAYMENT_REFUNDED', 'FEEDBACK_RECEIVED', 'TECHNICIAN_APPLICATION_SUBMITTED', 'TECHNICIAN_APPLICATION_REVIEWED', 'GENERAL');

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_notification_user_isRead" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "idx_notification_user_createdAt" ON "notifications"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_notification_type_entity" ON "notifications"("type", "entityId");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
