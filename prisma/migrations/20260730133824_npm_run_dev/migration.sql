-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BlogPost" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "authorName" TEXT,
    "authorRole" TEXT,
    "expertNote" TEXT,
    "coverAlt" TEXT,
    "focusKeyword" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'Журнал',
    "categorySlug" TEXT NOT NULL DEFAULT 'hair-care',
    "coverImage" TEXT NOT NULL DEFAULT '/site/img/blog/blog-hero.webp',
    "readingTime" TEXT NOT NULL DEFAULT '3 мин',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_BlogPost" ("authorName", "authorRole", "category", "categorySlug", "content", "coverAlt", "coverImage", "createdAt", "excerpt", "expertNote", "focusKeyword", "id", "isPublished", "publishedAt", "readingTime", "seoDescription", "seoTitle", "slug", "title", "updatedAt") SELECT "authorName", "authorRole", "category", "categorySlug", "content", "coverAlt", "coverImage", "createdAt", "excerpt", "expertNote", "focusKeyword", "id", "isPublished", "publishedAt", "readingTime", "seoDescription", "seoTitle", "slug", "title", "updatedAt" FROM "BlogPost";
DROP TABLE "BlogPost";
ALTER TABLE "new_BlogPost" RENAME TO "BlogPost";
CREATE UNIQUE INDEX "BlogPost_slug_key" ON "BlogPost"("slug");
CREATE INDEX "BlogPost_isPublished_idx" ON "BlogPost"("isPublished");
CREATE INDEX "BlogPost_categorySlug_idx" ON "BlogPost"("categorySlug");
CREATE INDEX "BlogPost_publishedAt_idx" ON "BlogPost"("publishedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
