-- AlterTable
ALTER TABLE "cart_items" ADD COLUMN     "bookingDetails" JSONB;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "bookingDetails" JSONB;
