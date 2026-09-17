-- AlterEnum
ALTER TYPE "OrderChannel" ADD VALUE 'SERVICE';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "isService" BOOLEAN NOT NULL DEFAULT false;
