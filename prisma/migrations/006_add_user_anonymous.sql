-- Migration 006 — 2026-10-22
-- Add a boolean `anonymous` flag on User. SQLite stores booleans as INTEGER
-- 0/1 (Prisma maps Boolean to INTEGER). It is set to true for ad-hoc users
-- created server-side when a guest publishes a tier list. Lets analytics
-- filter real users from anonymous contributors, and the login-time claim
-- flow transfer their lists to a real account.
ALTER TABLE "User" ADD COLUMN "anonymous" INTEGER NOT NULL DEFAULT 0;
