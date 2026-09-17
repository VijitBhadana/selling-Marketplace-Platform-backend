-- DropForeignKey
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_productId_fkey";

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_listingId_fkey";

-- AlterTable
ALTER TABLE "order_items" ALTER COLUMN "productId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "shopName" TEXT,
ALTER COLUMN "listingId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: existing orders keep their shop's name once the shop is deleted.
UPDATE "orders" o SET "shopName" = COALESCE(l."shopName", l."title") FROM "listings" l WHERE l."id" = o."listingId";
