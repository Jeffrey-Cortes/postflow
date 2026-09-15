CREATE TABLE "DraftSegment" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "characterCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DraftSegment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DraftSegment_draftId_position_key"
ON "DraftSegment"("draftId", "position");

CREATE INDEX "DraftSegment_draftId_position_idx"
ON "DraftSegment"("draftId", "position");

ALTER TABLE "DraftSegment"
ADD CONSTRAINT "DraftSegment_draftId_fkey"
FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
