-- AlterTable
ALTER TABLE `Payment` ADD COLUMN `partnerAccountId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `LedgerAccount` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(40) NULL,
    `name` VARCHAR(120) NOT NULL,
    `kind` VARCHAR(20) NOT NULL,
    `openingFils` INTEGER NOT NULL DEFAULT 0,
    `openingDate` DATETIME(3) NULL,
    `statementBalanceFils` INTEGER NULL,
    `statementDate` DATETIME(3) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `LedgerAccount_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LedgerEntry` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `kind` VARCHAR(20) NOT NULL,
    `amountFils` INTEGER NOT NULL,
    `feeFils` INTEGER NOT NULL DEFAULT 0,
    `fromAccountId` VARCHAR(191) NULL,
    `toAccountId` VARCHAR(191) NULL,
    `category` VARCHAR(60) NULL,
    `description` TEXT NULL,
    `reference` VARCHAR(120) NULL,
    `source` VARCHAR(20) NOT NULL DEFAULT 'manual',
    `externalId` VARCHAR(80) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `LedgerEntry_externalId_key`(`externalId`),
    INDEX `LedgerEntry_date_idx`(`date`),
    INDEX `LedgerEntry_kind_idx`(`kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Payment_partnerAccountId_idx` ON `Payment`(`partnerAccountId`);

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_partnerAccountId_fkey` FOREIGN KEY (`partnerAccountId`) REFERENCES `LedgerAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LedgerEntry` ADD CONSTRAINT `LedgerEntry_fromAccountId_fkey` FOREIGN KEY (`fromAccountId`) REFERENCES `LedgerAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LedgerEntry` ADD CONSTRAINT `LedgerEntry_toAccountId_fkey` FOREIGN KEY (`toAccountId`) REFERENCES `LedgerAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

