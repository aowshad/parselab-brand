-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'VIDEO');

-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "animationsZipFileId" TEXT;

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "startsOn" DATE,
    "endsOn" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaItem" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "eventId" TEXT,
    "kind" "MediaKind" NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "imageFileId" TEXT,
    "pngFileId" TEXT,
    "sourceFileId" TEXT,
    "mp4FileId" TEXT,
    "silentFileId" TEXT,
    "webmFileId" TEXT,
    "gifFileId" TEXT,
    "posterFileId" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "durationMs" INTEGER,
    "hasAudio" BOOLEAN NOT NULL DEFAULT false,
    "processingAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Event_key_key" ON "Event"("key");

-- CreateIndex
CREATE INDEX "MediaItem_brandId_eventId_sortOrder_idx" ON "MediaItem"("brandId", "eventId", "sortOrder");

-- CreateIndex
CREATE INDEX "MediaItem_eventId_idx" ON "MediaItem"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaItem_brandId_key_key" ON "MediaItem"("brandId", "key");

-- AddForeignKey
ALTER TABLE "MediaItem" ADD CONSTRAINT "MediaItem_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaItem" ADD CONSTRAINT "MediaItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Same lock-down as every table: no access through the Supabase REST API.
ALTER TABLE "Event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MediaItem" ENABLE ROW LEVEL SECURITY;
