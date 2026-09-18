-- CreateEnum
CREATE TYPE "AdvertisementKind" AS ENUM ('SHOP', 'SERVICE');

-- CreateEnum
CREATE TYPE "AdAudience" AS ENUM ('ALL', 'BUYER', 'SELLER');

-- CreateTable
CREATE TABLE "advertisements" (
    "id" TEXT NOT NULL,
    "kind" "AdvertisementKind" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT NOT NULL,
    "linkUrl" TEXT,
    "audience" "AdAudience" NOT NULL DEFAULT 'ALL',
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "advertisements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advertisement_views" (
    "advertisementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "advertisement_views_pkey" PRIMARY KEY ("advertisementId","userId")
);

-- CreateIndex
CREATE INDEX "advertisements_createdAt_idx" ON "advertisements"("createdAt");

-- CreateIndex
CREATE INDEX "advertisement_views_userId_idx" ON "advertisement_views"("userId");

-- AddForeignKey
ALTER TABLE "advertisement_views" ADD CONSTRAINT "advertisement_views_advertisementId_fkey" FOREIGN KEY ("advertisementId") REFERENCES "advertisements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advertisement_views" ADD CONSTRAINT "advertisement_views_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

