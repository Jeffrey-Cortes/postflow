-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('FACEBOOK', 'X');
CREATE TYPE "RequestStatus" AS ENUM ('RECEIVING', 'READY_FOR_GENERATION', 'PENDING_REVIEW', 'PUBLISHING', 'COMPLETED', 'REJECTED', 'FAILED');
CREATE TYPE "AssetKind" AS ENUM ('IMAGE', 'DOCUMENT');
CREATE TYPE "DraftStatus" AS ENUM ('PROPOSED', 'APPROVED', 'REJECTED', 'SUPERSEDED');
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'REJECTED');
CREATE TYPE "PublicationStatus" AS ENUM ('PENDING', 'PUBLISHING', 'PUBLISHED', 'FAILED');
CREATE TYPE "AuditEventType" AS ENUM ('REQUEST_CREATED', 'DRAFT_GENERATED', 'DRAFT_VALIDATED', 'APPROVAL_RECORDED', 'PUBLICATION_ATTEMPTED', 'PUBLICATION_COMPLETED', 'PUBLICATION_FAILED');

CREATE TABLE "Organization" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "slug" TEXT NOT NULL,
  "configuration" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "User" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "telegramUserId" TEXT NOT NULL,
  "displayName" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "StyleRule" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "platform" "Platform", "name" TEXT NOT NULL,
  "isRequired" BOOLEAN NOT NULL DEFAULT false, "configuration" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "StyleRule_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PublicationRequest" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "requestedById" TEXT,
  "telegramChatId" TEXT NOT NULL, "status" "RequestStatus" NOT NULL DEFAULT 'RECEIVING',
  "sourceSummary" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "PublicationRequest_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ReceivedMessage" (
  "id" TEXT NOT NULL, "publicationRequestId" TEXT, "telegramChatId" TEXT NOT NULL,
  "telegramMessageId" TEXT NOT NULL, "telegramUpdateId" TEXT NOT NULL, "mediaGroupId" TEXT,
  "text" TEXT, "caption" TEXT, "receivedAt" TIMESTAMP(3) NOT NULL, "rawPayload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReceivedMessage_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Asset" (
  "id" TEXT NOT NULL, "publicationRequestId" TEXT, "receivedMessageId" TEXT,
  "kind" "AssetKind" NOT NULL, "originalFilename" TEXT, "mimeType" TEXT, "sizeBytes" INTEGER,
  "telegramFileId" TEXT, "storageKey" TEXT, "checksum" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Draft" (
  "id" TEXT NOT NULL, "publicationRequestId" TEXT NOT NULL, "platform" "Platform" NOT NULL,
  "version" INTEGER NOT NULL, "status" "DraftStatus" NOT NULL DEFAULT 'PROPOSED', "content" TEXT NOT NULL,
  "validationResult" JSONB, "generationContext" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Draft_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "HistoricalPost" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "platform" "Platform" NOT NULL,
  "externalId" TEXT, "text" TEXT NOT NULL, "imageUrls" JSONB, "publishedAt" TIMESTAMP(3), "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HistoricalPost_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Approval" (
  "id" TEXT NOT NULL, "publicationRequestId" TEXT NOT NULL, "draftId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "platform" "Platform" NOT NULL, "decision" "ApprovalDecision" NOT NULL, "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Publication" (
  "id" TEXT NOT NULL, "publicationRequestId" TEXT NOT NULL, "draftId" TEXT NOT NULL,
  "platform" "Platform" NOT NULL, "status" "PublicationStatus" NOT NULL DEFAULT 'PENDING',
  "idempotencyKey" TEXT NOT NULL, "externalPostId" TEXT, "externalUrl" TEXT, "errorMessage" TEXT,
  "publishedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Publication_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AuditEvent" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "publicationRequestId" TEXT, "userId" TEXT,
  "type" "AuditEventType" NOT NULL, "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE UNIQUE INDEX "User_telegramUserId_key" ON "User"("telegramUserId");
CREATE INDEX "StyleRule_organizationId_platform_isActive_idx" ON "StyleRule"("organizationId", "platform", "isActive");
CREATE INDEX "PublicationRequest_organizationId_status_createdAt_idx" ON "PublicationRequest"("organizationId", "status", "createdAt");
CREATE INDEX "PublicationRequest_telegramChatId_createdAt_idx" ON "PublicationRequest"("telegramChatId", "createdAt");
CREATE UNIQUE INDEX "ReceivedMessage_telegramUpdateId_key" ON "ReceivedMessage"("telegramUpdateId");
CREATE UNIQUE INDEX "ReceivedMessage_telegramChatId_telegramMessageId_key" ON "ReceivedMessage"("telegramChatId", "telegramMessageId");
CREATE INDEX "ReceivedMessage_telegramChatId_mediaGroupId_receivedAt_idx" ON "ReceivedMessage"("telegramChatId", "mediaGroupId", "receivedAt");
CREATE INDEX "Asset_publicationRequestId_idx" ON "Asset"("publicationRequestId");
CREATE INDEX "Asset_receivedMessageId_idx" ON "Asset"("receivedMessageId");
CREATE UNIQUE INDEX "Draft_publicationRequestId_platform_version_key" ON "Draft"("publicationRequestId", "platform", "version");
CREATE INDEX "Draft_publicationRequestId_platform_status_idx" ON "Draft"("publicationRequestId", "platform", "status");
CREATE UNIQUE INDEX "HistoricalPost_organizationId_platform_externalId_key" ON "HistoricalPost"("organizationId", "platform", "externalId");
CREATE INDEX "HistoricalPost_organizationId_platform_publishedAt_idx" ON "HistoricalPost"("organizationId", "platform", "publishedAt");
CREATE INDEX "Approval_publicationRequestId_platform_createdAt_idx" ON "Approval"("publicationRequestId", "platform", "createdAt");
CREATE UNIQUE INDEX "Publication_idempotencyKey_key" ON "Publication"("idempotencyKey");
CREATE UNIQUE INDEX "Publication_publicationRequestId_platform_key" ON "Publication"("publicationRequestId", "platform");
CREATE INDEX "Publication_status_createdAt_idx" ON "Publication"("status", "createdAt");
CREATE INDEX "AuditEvent_organizationId_createdAt_idx" ON "AuditEvent"("organizationId", "createdAt");
CREATE INDEX "AuditEvent_publicationRequestId_createdAt_idx" ON "AuditEvent"("publicationRequestId", "createdAt");

ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StyleRule" ADD CONSTRAINT "StyleRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PublicationRequest" ADD CONSTRAINT "PublicationRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PublicationRequest" ADD CONSTRAINT "PublicationRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReceivedMessage" ADD CONSTRAINT "ReceivedMessage_publicationRequestId_fkey" FOREIGN KEY ("publicationRequestId") REFERENCES "PublicationRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_publicationRequestId_fkey" FOREIGN KEY ("publicationRequestId") REFERENCES "PublicationRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_receivedMessageId_fkey" FOREIGN KEY ("receivedMessageId") REFERENCES "ReceivedMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_publicationRequestId_fkey" FOREIGN KEY ("publicationRequestId") REFERENCES "PublicationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HistoricalPost" ADD CONSTRAINT "HistoricalPost_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_publicationRequestId_fkey" FOREIGN KEY ("publicationRequestId") REFERENCES "PublicationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_publicationRequestId_fkey" FOREIGN KEY ("publicationRequestId") REFERENCES "PublicationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_publicationRequestId_fkey" FOREIGN KEY ("publicationRequestId") REFERENCES "PublicationRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
