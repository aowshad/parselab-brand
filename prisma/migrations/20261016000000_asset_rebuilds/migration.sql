-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "assetsStaleAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "allKitStaleAt" TIMESTAMP(3);

