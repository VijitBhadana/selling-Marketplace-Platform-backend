-- Products a seller adds inside one of their shops, after the shop (Listing) itself is posted.
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2),
    "priceType" "PriceType" NOT NULL DEFAULT 'CONTACT_FOR_PRICE',
    "imageUrl" TEXT,
    "listingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "products_listingId_idx" ON "products"("listingId");

ALTER TABLE "products" ADD CONSTRAINT "products_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
