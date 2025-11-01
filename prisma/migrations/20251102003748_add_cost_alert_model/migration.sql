-- AlreadyExecuted: This migration represents changes already applied via db push
-- CostAlert model has been added to the database

-- CreateTable
CREATE TABLE IF NOT EXISTS "cost_alerts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "threshold_type" TEXT NOT NULL,
    "threshold_value" DECIMAL(10,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_alert_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "cost_alerts_project_id_idx" ON "cost_alerts"("project_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "cost_alerts_is_active_idx" ON "cost_alerts"("is_active");
