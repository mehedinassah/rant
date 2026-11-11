-- Vercel + Sentry integrations: provider-agnostic project links + webhook
-- idempotency ledger, plus provenance columns on the records they feed.
CREATE TYPE "IntegrationProvider" AS ENUM ('VERCEL', 'SENTRY');

-- AlterTable
ALTER TABLE "deployments" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "source" "RecordSource" NOT NULL DEFAULT 'NATIVE';

-- AlterTable
ALTER TABLE "incidents" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "source" "RecordSource" NOT NULL DEFAULT 'NATIVE';

-- CreateTable
CREATE TABLE "integration_project_links" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "externalProjectId" TEXT NOT NULL,
    "externalProjectName" TEXT,
    "repositoryId" TEXT NOT NULL,
    "environmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_project_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_webhook_deliveries" (
    "id" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "integration_project_links_organizationId_provider_idx" ON "integration_project_links"("organizationId", "provider");

-- CreateIndex
CREATE INDEX "integration_project_links_repositoryId_idx" ON "integration_project_links"("repositoryId");

-- CreateIndex
CREATE UNIQUE INDEX "integration_project_links_provider_externalProjectId_key" ON "integration_project_links"("provider", "externalProjectId");

-- CreateIndex
CREATE INDEX "integration_webhook_deliveries_provider_receivedAt_idx" ON "integration_webhook_deliveries"("provider", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "integration_webhook_deliveries_provider_deliveryId_key" ON "integration_webhook_deliveries"("provider", "deliveryId");

-- CreateIndex
CREATE UNIQUE INDEX "deployments_environmentId_externalId_key" ON "deployments"("environmentId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "incidents_monitorId_externalId_key" ON "incidents"("monitorId", "externalId");

-- AddForeignKey
ALTER TABLE "integration_project_links" ADD CONSTRAINT "integration_project_links_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_project_links" ADD CONSTRAINT "integration_project_links_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_project_links" ADD CONSTRAINT "integration_project_links_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "environments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
