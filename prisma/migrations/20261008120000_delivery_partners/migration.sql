-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'DELIVERY';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'DELIVERY_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE 'ORDER_PICKED_UP';
ALTER TYPE "NotificationType" ADD VALUE 'ORDER_DELIVERED';

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('SEARCHING', 'ASSIGNED', 'PICKED_UP', 'DELIVERED');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "deliveryStatus" "DeliveryStatus",
ADD COLUMN     "deliveryPartnerId" TEXT,
ADD COLUMN     "deliveryAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "pickedUpAt" TIMESTAMP(3),
ADD COLUMN     "deliveredAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "delivery_profiles" (
    "userId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "vehicleType" TEXT NOT NULL,
    "vehicleNumber" TEXT,
    "licenseNumber" TEXT NOT NULL,
    "licenseImage" TEXT NOT NULL,
    "aadhaarImage" TEXT NOT NULL,
    "city" TEXT,
    "pincode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_profiles_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "delivery_rejections" (
    "orderId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_rejections_pkey" PRIMARY KEY ("orderId","partnerId")
);

-- CreateIndex
CREATE UNIQUE INDEX "delivery_profiles_licenseNumber_key" ON "delivery_profiles"("licenseNumber");

-- CreateIndex
CREATE INDEX "delivery_rejections_partnerId_idx" ON "delivery_rejections"("partnerId");

-- CreateIndex
CREATE INDEX "orders_deliveryStatus_idx" ON "orders"("deliveryStatus");

-- CreateIndex
CREATE INDEX "orders_deliveryPartnerId_idx" ON "orders"("deliveryPartnerId");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_deliveryPartnerId_fkey" FOREIGN KEY ("deliveryPartnerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_profiles" ADD CONSTRAINT "delivery_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_rejections" ADD CONSTRAINT "delivery_rejections_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_rejections" ADD CONSTRAINT "delivery_rejections_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
