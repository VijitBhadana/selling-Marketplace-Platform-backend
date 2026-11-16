-- AlterTable
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "addressLine" TEXT,
                       ADD COLUMN IF NOT EXISTS "landmark" TEXT;
