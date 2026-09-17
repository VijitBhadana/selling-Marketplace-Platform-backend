-- CreateEnum
CREATE TYPE "WorkMode" AS ENUM ('ONSITE', 'REMOTE', 'HYBRID');

-- CreateEnum
CREATE TYPE "SalaryPeriod" AS ENUM ('MONTHLY', 'YEARLY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JobType" ADD VALUE 'INTERNSHIP';
ALTER TYPE "JobType" ADD VALUE 'CONTRACTUAL';
ALTER TYPE "JobType" ADD VALUE 'FREELANCE';

-- AlterEnum
ALTER TYPE "ApplicationStatus" ADD VALUE 'INTERVIEW_SCHEDULED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'JOB_APPLICATION';
ALTER TYPE "NotificationType" ADD VALUE 'INTERVIEW_SCHEDULED';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "jobId" TEXT;

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "isStartup" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pincode" TEXT,
ADD COLUMN     "responsibilities" TEXT,
ADD COLUMN     "salaryPeriod" "SalaryPeriod" NOT NULL DEFAULT 'YEARLY',
ADD COLUMN     "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "workMode" "WorkMode" NOT NULL DEFAULT 'ONSITE';

-- AlterTable
ALTER TABLE "job_applications" ADD COLUMN     "address" TEXT,
ADD COLUMN     "currentCompany" TEXT,
ADD COLUMN     "currentDesignation" TEXT,
ADD COLUMN     "currentLocation" TEXT,
ADD COLUMN     "currentSalary" INTEGER,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "fullName" TEXT,
ADD COLUMN     "interviewAt" TIMESTAMP(3),
ADD COLUMN     "interviewDetails" TEXT,
ADD COLUMN     "noticePeriod" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "resumeFileName" TEXT,
ADD COLUMN     "totalExperience" DOUBLE PRECISION,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "jobId" TEXT,
ALTER COLUMN "listingId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "jobs_categoryId_idx" ON "jobs"("categoryId");

-- CreateIndex
CREATE INDEX "jobs_postedById_idx" ON "jobs"("postedById");

-- CreateIndex
CREATE INDEX "jobs_createdAt_idx" ON "jobs"("createdAt");

-- CreateIndex
CREATE INDEX "job_applications_applicantId_idx" ON "job_applications"("applicantId");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_jobId_buyerId_key" ON "conversations"("jobId", "buyerId");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

