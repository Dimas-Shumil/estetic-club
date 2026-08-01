-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Lead" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "service" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "internalComment" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'website',
    "ipAddress" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',
    "consentAccepted" BOOLEAN NOT NULL DEFAULT false,
    "consentAcceptedAt" DATETIME,
    "assignedToId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lead_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "AdminUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Lead" ("assignedToId", "consentAccepted", "consentAcceptedAt", "createdAt", "id", "internalComment", "message", "name", "phone", "service", "source", "status", "updatedAt") SELECT "assignedToId", "consentAccepted", "consentAcceptedAt", "createdAt", "id", "internalComment", "message", "name", "phone", "service", "source", "status", "updatedAt" FROM "Lead";
DROP TABLE "Lead";
ALTER TABLE "new_Lead" RENAME TO "Lead";
CREATE INDEX "Lead_status_idx" ON "Lead"("status");
CREATE INDEX "Lead_assignedToId_idx" ON "Lead"("assignedToId");
CREATE INDEX "Lead_ipAddress_idx" ON "Lead"("ipAddress");
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
