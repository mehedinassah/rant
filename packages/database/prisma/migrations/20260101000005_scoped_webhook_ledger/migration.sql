-- Attribute each inbound delivery to the provider project it targets, so the
-- delivery log can be scoped to an org's linked projects (no cross-tenant reads).
ALTER TABLE "integration_webhook_deliveries" ADD COLUMN "externalProjectId" TEXT;

CREATE INDEX "integration_webhook_deliveries_provider_externalProjectId_idx"
  ON "integration_webhook_deliveries"("provider", "externalProjectId");
