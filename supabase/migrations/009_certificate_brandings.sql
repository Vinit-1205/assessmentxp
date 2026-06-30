-- Drop existing table if it exists
DROP TABLE IF EXISTS certificate_brandings;

-- Create new table for Certificate Brandings storing files as base64 referencing institutions(id)
CREATE TABLE IF NOT EXISTS certificate_brandings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID UNIQUE NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  logo_base64         TEXT,
  badge_base64        TEXT,
  signature_base64    TEXT,
  background_base64   TEXT,
  border_color        TEXT DEFAULT '#000000',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Disable RLS policy for reading and updating certificate brandings
ALTER TABLE certificate_brandings DISABLE ROW LEVEL SECURITY;
