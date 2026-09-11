-- A publication represents one concrete approved draft. Keeping it unique per
-- request/platform caused regenerated drafts to reuse an older draft identity
-- and idempotency key.
DROP INDEX "Publication_publicationRequestId_platform_key";
CREATE UNIQUE INDEX "Publication_draftId_key" ON "Publication"("draftId");
CREATE INDEX "Publication_publicationRequestId_platform_idx" ON "Publication"("publicationRequestId", "platform");
