-- Migration 007 — 2026-10-22
-- Private tier-list groups: a group is scoped to a single topic, lets members
-- see each other's tier lists live, and holds a lightweight chat anchored
-- either to the whole group or to a specific entry (per-film reactions).

CREATE TABLE "Group" (
  "id"         TEXT PRIMARY KEY,
  "name"       TEXT NOT NULL,
  "inviteSlug" TEXT NOT NULL UNIQUE,
  "topicId"    TEXT NOT NULL REFERENCES "Topic"("id") ON DELETE CASCADE,
  "ownerId"    TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "createdAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Group_topicId_idx" ON "Group"("topicId");
CREATE INDEX "Group_ownerId_idx" ON "Group"("ownerId");

CREATE TABLE "GroupMember" (
  "id"       TEXT PRIMARY KEY,
  "groupId"  TEXT NOT NULL REFERENCES "Group"("id") ON DELETE CASCADE,
  "userId"   TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "role"     TEXT NOT NULL DEFAULT 'MEMBER',
  "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("groupId", "userId")
);
CREATE INDEX "GroupMember_userId_idx" ON "GroupMember"("userId");

CREATE TABLE "GroupMessage" (
  "id"        TEXT PRIMARY KEY,
  "groupId"   TEXT NOT NULL REFERENCES "Group"("id") ON DELETE CASCADE,
  "authorId"  TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "entryId"   TEXT,
  "body"      TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "GroupMessage_groupId_createdAt_idx" ON "GroupMessage"("groupId", "createdAt");
CREATE INDEX "GroupMessage_groupId_entryId_createdAt_idx" ON "GroupMessage"("groupId", "entryId", "createdAt");
