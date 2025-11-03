/*
  Warnings:

  - Added the required column `last4` to the `api_keys` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."cost_data" DROP CONSTRAINT "cost_data_api_key_id_fkey";

-- AlterTable
ALTER TABLE "api_keys" ADD COLUMN     "last4" VARCHAR(4) NOT NULL;

-- CreateIndex
CREATE INDEX "api_keys_last4_idx" ON "api_keys"("last4");

-- AddForeignKey
ALTER TABLE "cost_data" ADD CONSTRAINT "cost_data_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;
