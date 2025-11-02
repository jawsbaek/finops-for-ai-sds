/*
  Warnings:

  - You are about to drop the column `team_id` on the `api_keys` table. All the data in the column will be lost.
  - You are about to drop the column `team_id` on the `cost_data` table. All the data in the column will be lost.
  - Added the required column `project_id` to the `api_keys` table without a default value. This is not possible if the table is not empty.
  - Made the column `project_id` on table `cost_data` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."api_keys" DROP CONSTRAINT "api_keys_team_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."cost_data" DROP CONSTRAINT "cost_data_project_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."cost_data" DROP CONSTRAINT "cost_data_team_id_fkey";

-- DropIndex
DROP INDEX "public"."api_keys_team_id_idx";

-- DropIndex
DROP INDEX "public"."cost_data_team_id_date_idx";

-- Data Migration: Delete all existing API keys (Breaking Change - users must re-register)
-- This ensures api_keys table is empty before adding NOT NULL project_id column
DELETE FROM "api_keys";

-- Data Migration: Backfill cost_data.project_id for rows where it's NULL
-- Assign costs to the team's first project, or delete if team has no projects
DO $$
DECLARE
    cost_record RECORD;
    first_project_id TEXT;
BEGIN
    -- For each cost_data row with NULL project_id
    FOR cost_record IN
        SELECT id, team_id FROM cost_data WHERE project_id IS NULL
    LOOP
        -- Find the first project for this team
        SELECT id INTO first_project_id
        FROM projects
        WHERE team_id = cost_record.team_id
        LIMIT 1;

        IF first_project_id IS NOT NULL THEN
            -- Assign to first project
            UPDATE cost_data
            SET project_id = first_project_id
            WHERE id = cost_record.id;
        ELSE
            -- No projects for this team, delete the cost record
            -- (Alternative: create a default project, but deletion is safer for data integrity)
            DELETE FROM cost_data WHERE id = cost_record.id;
        END IF;
    END LOOP;
END $$;

-- AlterTable
ALTER TABLE "api_keys" DROP COLUMN "team_id",
ADD COLUMN     "project_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "cost_data" DROP COLUMN "team_id",
ALTER COLUMN "project_id" SET NOT NULL;

-- CreateTable
CREATE TABLE "project_members" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_members_user_id_idx" ON "project_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_project_id_user_id_key" ON "project_members"("project_id", "user_id");

-- CreateIndex
CREATE INDEX "api_keys_project_id_idx" ON "api_keys"("project_id");

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_data" ADD CONSTRAINT "cost_data_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
