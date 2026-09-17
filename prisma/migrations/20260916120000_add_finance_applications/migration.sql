-- CreateEnum
CREATE TYPE "FinanceApplicationStatus" AS ENUM ('APPLIED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'FINANCE_APPLICATION';
ALTER TYPE "NotificationType" ADD VALUE 'FINANCE_DECISION';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "financeDetails" JSONB;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "financeApplicationId" TEXT,
ADD COLUMN     "listingId" TEXT;

-- CreateTable
CREATE TABLE "finance_applications" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "dateOfBirth" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT,
    "pincode" TEXT,
    "occupation" TEXT,
    "employerName" TEXT,
    "monthlyIncome" INTEGER,
    "existingEmi" INTEGER,
    "creditScore" INTEGER,
    "requestedAmount" INTEGER,
    "tenureMonths" INTEGER,
    "purpose" TEXT,
    "nomineeName" TEXT,
    "nomineeRelation" TEXT,
    "quote" JSONB,
    "termsSnapshot" JSONB,
    "acceptedTerms" BOOLEAN NOT NULL DEFAULT false,
    "status" "FinanceApplicationStatus" NOT NULL DEFAULT 'APPLIED',
    "sellerNote" TEXT,
    "approvedAmount" INTEGER,
    "approvedRate" DOUBLE PRECISION,
    "approvedTenure" INTEGER,
    "decidedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_documents" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "docNumber" TEXT,
    "fileName" TEXT NOT NULL,
    "dataUrl" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "finance_applications_applicantId_idx" ON "finance_applications"("applicantId");

-- CreateIndex
CREATE INDEX "finance_applications_sellerId_idx" ON "finance_applications"("sellerId");

-- CreateIndex
CREATE INDEX "finance_applications_listingId_idx" ON "finance_applications"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "finance_applications_productId_applicantId_key" ON "finance_applications"("productId", "applicantId");

-- CreateIndex
CREATE INDEX "finance_documents_applicationId_idx" ON "finance_documents"("applicationId");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_applications" ADD CONSTRAINT "finance_applications_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_applications" ADD CONSTRAINT "finance_applications_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_applications" ADD CONSTRAINT "finance_applications_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_applications" ADD CONSTRAINT "finance_applications_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_documents" ADD CONSTRAINT "finance_documents_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "finance_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
