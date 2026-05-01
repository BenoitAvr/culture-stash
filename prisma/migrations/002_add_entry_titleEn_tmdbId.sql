-- Migration 002 — 2026-05-01
-- Add titleEn (English title) and tmdbId (TMDB id, e.g. for movies/series) to Entry
ALTER TABLE Entry ADD COLUMN titleEn TEXT;
ALTER TABLE Entry ADD COLUMN tmdbId TEXT;
CREATE INDEX Entry_topicId_tmdbId_idx ON Entry(topicId, tmdbId);
