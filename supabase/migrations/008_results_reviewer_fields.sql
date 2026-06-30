-- Migration: add reviewed_by and reviewed_at columns to results table
-- so the Final Verdict can only be changed once and shows who did it.
ALTER TABLE results
  ADD COLUMN IF NOT EXISTS reviewed_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewer_email TEXT;
