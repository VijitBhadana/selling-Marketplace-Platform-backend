-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailOtpExpiresAt" TIMESTAMP(3),
ADD COLUMN     "emailOtpHash" TEXT,
ADD COLUMN     "isEmailVerified" BOOLEAN NOT NULL DEFAULT false;
