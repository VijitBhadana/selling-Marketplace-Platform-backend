-- CreateEnum
CREATE TYPE "SellerTaxIdRule" AS ENUM ('EITHER', 'BOTH_OPTIONAL', 'BOTH_REQUIRED', 'GST_REQUIRED', 'PAN_REQUIRED');

-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN     "seller_tax_id_rule" "SellerTaxIdRule" NOT NULL DEFAULT 'EITHER';
