-- AlterTable
ALTER TABLE "cost_data" ADD COLUMN "snapshot_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "unique_cost_record" ON "cost_data"("api_key_id", "date", "snapshot_id");
