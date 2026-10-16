-- AlterTable
ALTER TABLE "users" ADD COLUMN     "aadhaarHash" TEXT,
ADD COLUMN     "aadhaarLast4" TEXT,
ADD COLUMN     "gstin" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_aadhaarHash_key" ON "users"("aadhaarHash");

-- CreateIndex
CREATE UNIQUE INDEX "users_gstin_key" ON "users"("gstin");
