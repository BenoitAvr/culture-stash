-- Migration 008 — 2026-10-22
-- Drop the per-film group chat. V1 shipped with pastilles (coloured dots per
-- member on each tier card) as the comparison signal, and the threaded chat
-- was overkill for the actual use case, so the table and its indexes go.

DROP INDEX IF EXISTS "GroupMessage_groupId_entryId_createdAt_idx";
DROP INDEX IF EXISTS "GroupMessage_groupId_createdAt_idx";
DROP TABLE IF EXISTS "GroupMessage";
