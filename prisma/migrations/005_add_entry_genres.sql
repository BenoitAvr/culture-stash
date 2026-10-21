-- Migration 005 — 2026-10-21
-- Add a nullable `genres` column to Entry holding a comma-separated list
-- of TMDB genre IDs ("35,18"). TMDB IDs are locale-stable, so the mapping
-- to French / English labels lives in lib/genres.ts instead of the DB.
ALTER TABLE "Entry" ADD COLUMN "genres" TEXT;
