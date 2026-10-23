-- AlterTable
ALTER TABLE "users" ADD COLUMN     "pan" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_pan_key" ON "users"("pan");
