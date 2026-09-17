-- AlterEnum
ALTER TYPE "OrderChannel" ADD VALUE 'BOOKING';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "priceUnit" TEXT;
