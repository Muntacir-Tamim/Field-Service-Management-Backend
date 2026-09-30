-- DropIndex
DROP INDEX "assignments_technicianId_scheduledStart_scheduledEnd_status_key";

-- AlterTable
ALTER TABLE "assignments" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledBy" TEXT,
ADD COLUMN     "confirmedAt" TIMESTAMP(3);
