-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "BrandStatus" AS ENUM ('DRAFT', 'SOON', 'LIVE');

-- CreateEnum
CREATE TYPE "KitMode" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "ColorKind" AS ENUM ('SOLID', 'GRADIENT');

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "status" "BrandStatus" NOT NULL DEFAULT 'DRAFT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "accent" TEXT,
    "iconFileId" TEXT,
    "kitFileId" TEXT,
    "kitMode" "KitMode" NOT NULL DEFAULT 'AUTO',
    "kitBuiltAt" TIMESTAMP(3),
    "colorsCssFileId" TEXT,
    "colorsJsonFileId" TEXT,
    "ogFileId" TEXT,
    "typography" JSONB,
    "usage" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogoType" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "zipFileId" TEXT,

    CONSTRAINT "LogoType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogoVariant" (
    "id" TEXT NOT NULL,
    "logoTypeId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hint" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "previewBg" TEXT NOT NULL,
    "dot" TEXT,
    "svgFileId" TEXT,
    "png512Id" TEXT,
    "png1024Id" TEXT,
    "png2048Id" TEXT,
    "png4096Id" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LogoVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Color" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ColorKind" NOT NULL DEFAULT 'SOLID',
    "hex" TEXT,
    "gradient" JSONB,
    "cmyk" TEXT,
    "pantone" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Color_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileObject" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "sha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "homeTitle" TEXT NOT NULL DEFAULT 'Brand assets',
    "homeSubtitle" TEXT NOT NULL DEFAULT 'Logos, colors and guidelines for every ParseLab product.',
    "footerText" TEXT NOT NULL DEFAULT '© ParseLab LLC. Assets are for approved use only.',
    "contactEmail" TEXT NOT NULL DEFAULT 'brand@parselab.com',
    "allKitFileId" TEXT,
    "allKitMode" "KitMode" NOT NULL DEFAULT 'AUTO',
    "ogFileId" TEXT,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE INDEX "Session_adminId_idx" ON "Session"("adminId");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_slug_key" ON "Brand"("slug");

-- CreateIndex
CREATE INDEX "Brand_status_sortOrder_idx" ON "Brand"("status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "LogoType_brandId_key_key" ON "LogoType"("brandId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "LogoVariant_logoTypeId_key_key" ON "LogoVariant"("logoTypeId", "key");

-- CreateIndex
CREATE INDEX "Color_brandId_sortOrder_idx" ON "Color"("brandId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "FileObject_key_key" ON "FileObject"("key");

-- CreateIndex
CREATE INDEX "FileObject_sha256_idx" ON "FileObject"("sha256");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogoType" ADD CONSTRAINT "LogoType_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogoVariant" ADD CONSTRAINT "LogoVariant_logoTypeId_fkey" FOREIGN KEY ("logoTypeId") REFERENCES "LogoType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Color" ADD CONSTRAINT "Color_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

