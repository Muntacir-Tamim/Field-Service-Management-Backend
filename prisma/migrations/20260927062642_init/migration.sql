/*
  Warnings:

  - The values [ACTIVE,COMPLETED] on the enum `AssignmentStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [FINANCE] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.
  - The values [ASSIGNED,SCHEDULED,IN_PROGRESS] on the enum `ServiceRequestStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [CREATED,DISPATCHED,WORK_STARTED,WORK_COMPLETED,CLOSED] on the enum `WorkOrderStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `technicianId` on the `customer_feedbacks` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `amount` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the column `invoiceId` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `technicians` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `technicians` table. All the data in the column will be lost.
  - You are about to drop the `finance_users` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `invoice_items` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `invoices` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `notifications` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[invoiceNumber]` on the table `payments` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[gatewayPaymentId]` on the table `payments` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[workOrderId]` on the table `payments` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `invoiceNumber` to the `payments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subtotal` to the `payments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalAmount` to the `payments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workOrderId` to the `payments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AssignmentStatus_new" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');
ALTER TABLE "public"."assignments" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "assignments" ALTER COLUMN "status" TYPE "AssignmentStatus_new" USING ("status"::text::"AssignmentStatus_new");
ALTER TYPE "AssignmentStatus" RENAME TO "AssignmentStatus_old";
ALTER TYPE "AssignmentStatus_new" RENAME TO "AssignmentStatus";
DROP TYPE "public"."AssignmentStatus_old";
ALTER TABLE "assignments" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN', 'CUSTOMER');
ALTER TABLE "public"."users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'CUSTOMER';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "ServiceRequestStatus_new" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED');
ALTER TABLE "public"."service_requests" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "service_requests" ALTER COLUMN "status" TYPE "ServiceRequestStatus_new" USING ("status"::text::"ServiceRequestStatus_new");
ALTER TYPE "ServiceRequestStatus" RENAME TO "ServiceRequestStatus_old";
ALTER TYPE "ServiceRequestStatus_new" RENAME TO "ServiceRequestStatus";
DROP TYPE "public"."ServiceRequestStatus_old";
ALTER TABLE "service_requests" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "WorkOrderStatus_new" AS ENUM ('SCHEDULED', 'TECHNICIAN_EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'CANCELLED');
ALTER TABLE "public"."work_orders" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "work_orders" ALTER COLUMN "status" TYPE "WorkOrderStatus_new" USING ("status"::text::"WorkOrderStatus_new");
ALTER TYPE "WorkOrderStatus" RENAME TO "WorkOrderStatus_old";
ALTER TYPE "WorkOrderStatus_new" RENAME TO "WorkOrderStatus";
DROP TYPE "public"."WorkOrderStatus_old";
ALTER TABLE "work_orders" ALTER COLUMN "status" SET DEFAULT 'SCHEDULED';
COMMIT;

-- DropForeignKey
ALTER TABLE "customer_feedbacks" DROP CONSTRAINT "customer_feedbacks_technicianId_fkey";

-- DropForeignKey
ALTER TABLE "finance_users" DROP CONSTRAINT "finance_users_userId_fkey";

-- DropForeignKey
ALTER TABLE "invoice_items" DROP CONSTRAINT "invoice_items_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_financeUserId_fkey";

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_workOrderId_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_userId_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_invoiceId_fkey";

-- DropIndex
DROP INDEX "idx_feedback_technicianId";

-- DropIndex
DROP INDEX "customers_email_key";

-- DropIndex
DROP INDEX "payments_invoiceId_key";

-- DropIndex
DROP INDEX "technicians_email_key";

-- AlterTable
ALTER TABLE "customer_feedbacks" DROP COLUMN "technicianId";

-- AlterTable
ALTER TABLE "customers" DROP COLUMN "email",
DROP COLUMN "name";

-- AlterTable
ALTER TABLE "managers" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "amount",
DROP COLUMN "invoiceId",
ADD COLUMN     "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "gatewayPaymentId" TEXT,
ADD COLUMN     "invoiceNumber" TEXT NOT NULL,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "refundTransactionId" TEXT,
ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "subtotal" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalAmount" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "workOrderId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "technicians" DROP COLUMN "email",
DROP COLUMN "name",
ADD COLUMN     "reviewedBy" TEXT;

-- AlterTable
ALTER TABLE "work_orders" ALTER COLUMN "status" SET DEFAULT 'SCHEDULED';

-- DropTable
DROP TABLE "finance_users";

-- DropTable
DROP TABLE "invoice_items";

-- DropTable
DROP TABLE "invoices";

-- DropTable
DROP TABLE "notifications";

-- DropEnum
DROP TYPE "InvoiceStatus";

-- DropEnum
DROP TYPE "NotificationStatus";

-- DropEnum
DROP TYPE "NotificationType";

-- CreateIndex
CREATE UNIQUE INDEX "payments_invoiceNumber_key" ON "payments"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "payments_gatewayPaymentId_key" ON "payments"("gatewayPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_workOrderId_key" ON "payments"("workOrderId");

-- CreateIndex
CREATE INDEX "idx_payment_status" ON "payments"("status");

-- CreateIndex
CREATE INDEX "idx_technician_verificationStatus" ON "technicians"("verificationStatus");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "idx_sr_attachment_srId" RENAME TO "idx_sra_serviceRequestId";

-- RenameIndex
ALTER INDEX "idx_wo_attachment_woId" RENAME TO "idx_woa_workOrderId";
