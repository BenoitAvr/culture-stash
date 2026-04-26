/*
  Warnings:

  - Added the required column `badge` to the `TopicTranslation` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TopicTranslation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topicId" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "badge" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "desc" TEXT NOT NULL,
    "prose" TEXT NOT NULL,
    "diffNote" TEXT NOT NULL,
    CONSTRAINT "TopicTranslation_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TopicTranslation" ("desc", "diffNote", "id", "lang", "prose", "title", "topicId") SELECT "desc", "diffNote", "id", "lang", "prose", "title", "topicId" FROM "TopicTranslation";
DROP TABLE "TopicTranslation";
ALTER TABLE "new_TopicTranslation" RENAME TO "TopicTranslation";
CREATE UNIQUE INDEX "TopicTranslation_topicId_lang_key" ON "TopicTranslation"("topicId", "lang");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
