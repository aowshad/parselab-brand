-- CreateTable
CREATE TABLE "UploadTicket" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "brandId" TEXT,
    "fileName" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mime" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "UploadTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandRedirect" (
    "fromSlug" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandRedirect_pkey" PRIMARY KEY ("fromSlug")
);

-- CreateIndex
CREATE UNIQUE INDEX "UploadTicket_key_key" ON "UploadTicket"("key");

-- CreateIndex
CREATE INDEX "UploadTicket_issuedAt_idx" ON "UploadTicket"("issuedAt");

-- AddForeignKey
ALTER TABLE "BrandRedirect" ADD CONSTRAINT "BrandRedirect_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Same lock-down as every table: no access through the Supabase REST API.
ALTER TABLE "UploadTicket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BrandRedirect" ENABLE ROW LEVEL SECURITY;
