CREATE TYPE "ReviewSessionAction" AS ENUM ('EDIT');
CREATE TABLE "ReviewSession" (
  "id" TEXT NOT NULL,
  "publicationRequestId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "platform" "Platform" NOT NULL,
  "action" "ReviewSessionAction" NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReviewSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReviewSession_userId_completedAt_expiresAt_idx" ON "ReviewSession"("userId", "completedAt", "expiresAt");
ALTER TABLE "ReviewSession" ADD CONSTRAINT "ReviewSession_publicationRequestId_fkey" FOREIGN KEY ("publicationRequestId") REFERENCES "PublicationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewSession" ADD CONSTRAINT "ReviewSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
