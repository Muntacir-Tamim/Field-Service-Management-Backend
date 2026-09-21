/*
  Warnings:

  - You are about to drop the column `partsUsed` on the `work_orders` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[technicianId,scheduledStart,scheduledEnd,status]` on the table `assignments` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email]` on the table `customers` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `email` to the `customers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `customers` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- DropIndex
DROP INDEX "assignments_serviceRequestId_key";

-- DropIndex
DROP INDEX "assignments_technicianId_scheduledStart_scheduledEnd_key";

-- AlterTable
ALTER TABLE "assignments" ADD COLUMN     "status" "AssignmentStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "name" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "work_orders" DROP COLUMN "partsUsed";

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "invoiceId" TEXT NOT NULL,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_parts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitCost" DECIMAL(10,2) NOT NULL,
    "totalCost" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workOrderId" TEXT NOT NULL,

    CONSTRAINT "work_order_parts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_invoice_item_invoiceId" ON "invoice_items"("invoiceId");

-- CreateIndex
CREATE INDEX "idx_wo_part_workOrderId" ON "work_order_parts"("workOrderId");

-- CreateIndex
CREATE INDEX "idx_assignment_serviceRequestId" ON "assignments"("serviceRequestId");

-- CreateIndex
CREATE INDEX "idx_assignment_status" ON "assignments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "assignments_technicianId_scheduledStart_scheduledEnd_status_key" ON "assignments"("technicianId", "scheduledStart", "scheduledEnd", "status");

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_parts" ADD CONSTRAINT "work_order_parts_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
