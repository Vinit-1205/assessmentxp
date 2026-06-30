-- Migration: Add is_released boolean column to results table
ALTER TABLE results
  ADD COLUMN IF NOT EXISTS is_released BOOLEAN NOT NULL DEFAULT false;
