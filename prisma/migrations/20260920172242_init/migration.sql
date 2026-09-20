/*
  Warnings:

  - You are about to drop the column `email` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `finance_users` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `finance_users` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `managers` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `managers` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `technicians` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `technicians` table. All the data in the column will be lost.
  - You are about to drop the `attachments` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `technicianId` to the `customer_feedbacks` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "attachments" DROP CONSTRAINT "attachments_serviceRequestId_fkey";

-- DropForeignKey
ALTER TABLE "attachments" DROP CONSTRAINT "attachments_workOrderId_fkey";

-- DropIndex
DROP INDEX "customers_email_key";

-- DropIndex
DROP INDEX "idx_customer_email";

-- DropIndex
DROP INDEX "finance_users_email_key";

-- DropIndex
DROP INDEX "managers_email_key";

-- DropIndex
DROP INDEX "idx_technician_email";

-- DropIndex
DROP INDEX "technicians_email_key";

-- AlterTable
ALTER TABLE "customer_feedbacks" ADD COLUMN     "technicianId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "customers" DROP COLUMN "email",
DROP COLUMN "name";

-- AlterTable
ALTER TABLE "finance_users" DROP COLUMN "email",
DROP COLUMN "name";

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "financeUserId" TEXT;

-- AlterTable
ALTER TABLE "managers" DROP COLUMN "email",
DROP COLUMN "name";

-- AlterTable
ALTER TABLE "technicians" DROP COLUMN "email",
DROP COLUMN "name";

-- DropTable
DROP TABLE "attachments";

-- CreateTable
CREATE TABLE "service_request_attachments" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serviceRequestId" TEXT NOT NULL,

    CONSTRAINT "service_request_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_attachments" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workOrderId" TEXT NOT NULL,

    CONSTRAINT "work_order_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_sr_attachment_srId" ON "service_request_attachments"("serviceRequestId");

-- CreateIndex
CREATE INDEX "idx_wo_attachment_woId" ON "work_order_attachments"("workOrderId");

-- CreateIndex
CREATE INDEX "idx_feedback_technicianId" ON "customer_feedbacks"("technicianId");

-- AddForeignKey
ALTER TABLE "customer_feedbacks" ADD CONSTRAINT "customer_feedbacks_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "technicians"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_financeUserId_fkey" FOREIGN KEY ("financeUserId") REFERENCES "finance_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request_attachments" ADD CONSTRAINT "service_request_attachments_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_attachments" ADD CONSTRAINT "work_order_attachments_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
