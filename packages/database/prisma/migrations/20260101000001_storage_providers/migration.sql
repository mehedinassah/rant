-- Storage provider abstraction: bytes move out of file_objects into a decoupled
-- blob store (or S3). Non-destructive — existing inline content is preserved.

-- AlterTable: content becomes optional; record which provider holds the bytes.
ALTER TABLE "file_objects" ALTER COLUMN "content" DROP NOT NULL;
ALTER TABLE "file_objects" ADD COLUMN "storageProvider" TEXT NOT NULL DEFAULT 'db';

-- CreateTable: DB-backed blob store (default provider).
CREATE TABLE "storage_blobs" (
    "key" TEXT NOT NULL,
    "content" BYTEA NOT NULL,
    "contentType" TEXT,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storage_blobs_pkey" PRIMARY KEY ("key")
);
