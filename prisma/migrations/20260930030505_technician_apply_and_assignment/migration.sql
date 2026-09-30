-- AlterTable
ALTER TABLE "technicians" ADD COLUMN     "documents" JSONB,
ADD COLUMN     "resumePublicId" TEXT,
ADD COLUMN     "resumeUrl" TEXT;
