CREATE TABLE "TelegramMediaGroup" (
  "id" TEXT NOT NULL,
  "publicationRequestId" TEXT NOT NULL,
  "telegramChatId" TEXT NOT NULL,
  "mediaGroupId" TEXT NOT NULL,
  "firstReceivedAt" TIMESTAMP(3) NOT NULL,
  "lastReceivedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TelegramMediaGroup_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TelegramMediaGroup_publicationRequestId_key" ON "TelegramMediaGroup"("publicationRequestId");
CREATE UNIQUE INDEX "TelegramMediaGroup_telegramChatId_mediaGroupId_key" ON "TelegramMediaGroup"("telegramChatId", "mediaGroupId");
ALTER TABLE "TelegramMediaGroup" ADD CONSTRAINT "TelegramMediaGroup_publicationRequestId_fkey" FOREIGN KEY ("publicationRequestId") REFERENCES "PublicationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
