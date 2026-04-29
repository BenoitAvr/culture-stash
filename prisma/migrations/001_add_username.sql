-- Migration 001 — 2026-04-29
-- Add unique username field to User table
ALTER TABLE User ADD COLUMN username TEXT;
CREATE UNIQUE INDEX User_username_key ON User(username) WHERE username IS NOT NULL;
