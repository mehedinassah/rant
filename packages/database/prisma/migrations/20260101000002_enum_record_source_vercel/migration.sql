-- Record provenance: deployments synced from Vercel.
-- Kept as its own migration because PostgreSQL enum values are best added
-- one at a time (and the new value cannot be used in the same transaction).
ALTER TYPE "RecordSource" ADD VALUE 'VERCEL';
