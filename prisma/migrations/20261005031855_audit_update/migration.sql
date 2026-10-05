-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('SERVICE_REQUEST_CREATED', 'SERVICE_REQUEST_STATUS_CHANGED', 'ASSIGNMENT_CREATED', 'ASSIGNMENT_CONFIRMED', 'ASSIGNMENT_CANCELLED', 'ASSIGNMENT_RESCHEDULED', 'WORK_ORDER_STATUS_CHANGED', 'INVOICE_CREATED', 'PAYMENT_INITIATED', 'PAYMENT_PAID', 'PAYMENT_FAILED', 'PAYMENT_CANCELLED', 'PAYMENT_REFUNDED', 'TECHNICIAN_REVIEWED', 'SKILL_CREATED', 'SKILL_UPDATED', 'SKILL_DELETED', 'FEEDBACK_DELETED', 'MANAGER_CREATED');

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "metadata" JSONB,
    "actorId" TEXT,
    "actorRole" "Role",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_audit_entity" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "idx_audit_actor" ON "audit_logs"("actorId");

-- CreateIndex
CREATE INDEX "idx_audit_action" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "idx_audit_createdAt" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
