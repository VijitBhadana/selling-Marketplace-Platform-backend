-- CreateEnum
CREATE TYPE "GlowLevel" AS ENUM ('VIVID', 'SUBTLE', 'MINIMAL');

-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN "glow" "GlowLevel" NOT NULL DEFAULT 'VIVID',
                            ADD COLUMN "updatedBy" TEXT;
