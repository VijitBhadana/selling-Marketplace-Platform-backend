-- CreateTable
CREATE TABLE "shop_certificates" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "productId" TEXT,
    "title" TEXT NOT NULL,
    "number" TEXT,
    "image" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shop_certificates_productId_key" ON "shop_certificates"("productId");

-- CreateIndex
CREATE INDEX "shop_certificates_listingId_idx" ON "shop_certificates"("listingId");

-- AddForeignKey
ALTER TABLE "shop_certificates" ADD CONSTRAINT "shop_certificates_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_certificates" ADD CONSTRAINT "shop_certificates_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
