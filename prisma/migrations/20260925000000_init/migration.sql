-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(191) NOT NULL,
    `ziinaIntentId` VARCHAR(100) NOT NULL,
    `amountFils` INTEGER NOT NULL,
    `currency` VARCHAR(10) NOT NULL DEFAULT 'AED',
    `message` TEXT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'requires_payment_instrument',
    `redirectUrl` TEXT NULL,
    `operationId` VARCHAR(100) NULL,
    `feeFils` INTEGER NOT NULL DEFAULT 0,
    `tipFils` INTEGER NOT NULL DEFAULT 0,
    `settledFils` INTEGER NULL,
    `paidAt` DATETIME(3) NULL,
    `cardBrand` VARCHAR(40) NULL,
    `cardLast4` VARCHAR(8) NULL,
    `lastErrorZiina` TEXT NULL,
    `customerName` VARCHAR(200) NULL,
    `customerEmail` VARCHAR(200) NULL,
    `customerPhone` VARCHAR(40) NULL,
    `notes` TEXT NULL,
    `source` VARCHAR(20) NOT NULL DEFAULT 'api',
    `test` BOOLEAN NOT NULL DEFAULT false,
    `zohoStatus` VARCHAR(20) NOT NULL DEFAULT 'not_synced',
    `zohoContactId` VARCHAR(40) NULL,
    `zohoItemId` VARCHAR(40) NULL,
    `zohoItemName` VARCHAR(255) NULL,
    `zohoInvoiceId` VARCHAR(40) NULL,
    `zohoInvoiceNumber` VARCHAR(60) NULL,
    `zohoPaymentId` VARCHAR(40) NULL,
    `emailSent` BOOLEAN NOT NULL DEFAULT false,
    `lastError` TEXT NULL,
    `syncedAt` DATETIME(3) NULL,
    `zohoCheckedAt` DATETIME(3) NULL,
    `zohoCandidates` TEXT NULL,
    `zohoCandidateCount` INTEGER NOT NULL DEFAULT 0,
    `zohoIgnoredIds` VARCHAR(2000) NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Payment_ziinaIntentId_key`(`ziinaIntentId`),
    INDEX `Payment_status_idx`(`status`),
    INDEX `Payment_zohoStatus_idx`(`zohoStatus`),
    INDEX `Payment_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SyncLog` (
    `id` VARCHAR(191) NOT NULL,
    `paymentId` VARCHAR(191) NOT NULL,
    `step` VARCHAR(40) NOT NULL,
    `success` BOOLEAN NOT NULL,
    `detail` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SyncLog_paymentId_idx`(`paymentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Setting` (
    `key` VARCHAR(100) NOT NULL,
    `value` TEXT NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SyncLog` ADD CONSTRAINT `SyncLog_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `Payment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

