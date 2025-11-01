-- CreateTable
CREATE TABLE "cost_data" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "project_id" TEXT,
    "api_key_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "model" TEXT,
    "tokens" INTEGER,
    "cost" DECIMAL(10,2) NOT NULL,
    "date" DATE NOT NULL,
    "task_type" TEXT,
    "user_intent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cron_logs" (
    "id" TEXT NOT NULL,
    "job_name" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cron_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cost_data_team_id_date_idx" ON "cost_data"("team_id", "date");

-- CreateIndex
CREATE INDEX "cost_data_project_id_date_idx" ON "cost_data"("project_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "cron_logs_job_name_date_key" ON "cron_logs"("job_name", "date");

-- AddForeignKey
ALTER TABLE "cost_data" ADD CONSTRAINT "cost_data_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_data" ADD CONSTRAINT "cost_data_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_data" ADD CONSTRAINT "cost_data_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
