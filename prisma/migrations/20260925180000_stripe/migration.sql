-- AlterTable
ALTER TABLE `Payment` ADD COLUMN `amountRefundedFils` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `gateway` VARCHAR(20) NOT NULL DEFAULT 'ziina',
    ADD COLUMN `stripeInvoiceId` VARCHAR(60) NULL,
    ADD COLUMN `stripeInvoiceNumber` VARCHAR(60) NULL,
    ADD COLUMN `stripeInvoicePdf` TEXT NULL,
    ADD COLUMN `stripeInvoiceUrl` TEXT NULL;

-- CreateIndex
CREATE INDEX `Payment_gateway_idx` ON `Payment`(`gateway`);

