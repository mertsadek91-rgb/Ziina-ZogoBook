-- AlterTable
ALTER TABLE `Payment` ADD COLUMN `archived` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `Payment_archived_idx` ON `Payment`(`archived`);

