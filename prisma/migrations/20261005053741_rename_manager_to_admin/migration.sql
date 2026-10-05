/*
  Warnings:

  - The values [MANAGER_CREATED] on the enum `AuditAction` will be removed. If these variants are still used in the database, this will fail.
  - The values [CUSTOMER] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `managerId` on the `service_requests` table. All the data in the column will be lost.
  - You are about to drop the `managers` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AuditAction_new" AS ENUM ('SERVICE_REQUEST_CREATED', 'SERVICE_REQUEST_STATUS_CHANGED', 'ASSIGNMENT_CREATED', 'ASSIGNMENT_CONFIRMED', 'ASSIGNMENT_CANCELLED', 'ASSIGNMENT_RESCHEDULED', 'WORK_ORDER_STATUS_CHANGED', 'INVOICE_CREATED', 'PAYMENT_INITIATED', 'PAYMENT_PAID', 'PAYMENT_FAILED', 'PAYMENT_CANCELLED', 'PAYMENT_REFUNDED', 'TECHNICIAN_REVIEWED', 'SKILL_CREATED', 'SKILL_UPDATED', 'SKILL_DELETED', 'FEEDBACK_DELETED', 'ADMIN_CREATED');
ALTER TABLE "audit_logs" ALTER COLUMN "action" TYPE "AuditAction_new" USING ("action"::text::"AuditAction_new");
ALTER TYPE "AuditAction" RENAME TO "AuditAction_old";
ALTER TYPE "AuditAction_new" RENAME TO "AuditAction";
DROP TYPE "public"."AuditAction_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('MANAGER', 'TECHNICIAN', 'ADMIN');
ALTER TABLE "public"."users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "audit_logs" ALTER COLUMN "actorRole" TYPE "Role_new" USING ("actorRole"::text::"Role_new");
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'ADMIN';
COMMIT;

-- DropForeignKey
ALTER TABLE "managers" DROP CONSTRAINT "managers_userId_fkey";

-- DropForeignKey
ALTER TABLE "service_requests" DROP CONSTRAINT "service_requests_managerId_fkey";

-- AlterTable
ALTER TABLE "service_requests" DROP COLUMN "managerId",
ADD COLUMN     "adminId" TEXT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'ADMIN';

-- DropTable
DROP TABLE "managers";

-- CreateTable
CREATE TABLE "admins" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "contactNumber" TEXT,
    "department" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "admins_userId_key" ON "admins"("userId");

-- AddForeignKey
ALTER TABLE "admins" ADD CONSTRAINT "admins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
