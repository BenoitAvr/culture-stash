-- Migration 004 — 2026-10-20
-- Add a `kind` column to Entry so a single row can represent either a
-- standalone film (default) or a whole saga/franchise ("SAGA"). SAGA
-- entries intentionally skip the year input since a franchise doesn't
-- have a single release date.
ALTER TABLE "Entry" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'FILM';
