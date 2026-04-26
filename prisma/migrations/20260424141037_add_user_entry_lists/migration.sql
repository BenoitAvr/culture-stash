-- CreateTable
CREATE TABLE "UserEntryList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserEntryList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserEntryList_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserEntryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "position" INTEGER,
    "tier" TEXT,
    "note" TEXT,
    CONSTRAINT "UserEntryItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "UserEntryList" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserEntryItem_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "UserEntryList_userId_topicId_key" ON "UserEntryList"("userId", "topicId");
