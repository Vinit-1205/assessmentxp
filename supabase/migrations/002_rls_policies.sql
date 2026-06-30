-- ============================================================
-- AssessmentXP — Row Level Security Policies
-- Translated from Base44 entity .jsonc RLS definitions
--
-- JWT claim strategy:
--   auth.jwt() ->> 'institution_id'  → user's active institution UUID
--   auth.jwt() ->> 'active_role'     → user's active role string
--
-- These custom claims are set in app_metadata by the Express backend
-- whenever a user logs in or changes their active institution.
-- ============================================================

-- Helper: get active role from JWT
-- Returns the active_role from app_metadata (set by backend at login)
CREATE OR REPLACE FUNCTION auth_active_role()
RETURNS TEXT
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'active_role',
    auth.jwt() ->> 'role',
    'anon'
  );
$$;

-- Helper: get active institution_id from JWT
CREATE OR REPLACE FUNCTION auth_institution_id()
RETURNS UUID
LANGUAGE sql STABLE
AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'institution_id')::UUID;
$$;

-- ────────────────────────────────────────────────────────────
-- INSTITUTIONS
-- ────────────────────────────────────────────────────────────
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;

-- Read: super_admin/admin see all; any user sees their own institution
CREATE POLICY "institutions_read" ON institutions
  FOR SELECT USING (
    auth_active_role() IN ('admin', 'super_admin')
    OR id = auth_institution_id()
  );

-- Create: super_admin only
CREATE POLICY "institutions_create" ON institutions
  FOR INSERT WITH CHECK (
    auth_active_role() = 'super_admin'
  );

-- Update: super_admin/admin OR tenant_admin of their own institution
CREATE POLICY "institutions_update" ON institutions
  FOR UPDATE USING (
    auth_active_role() IN ('admin', 'super_admin')
    OR (id = auth_institution_id() AND auth_active_role() = 'tenant_admin')
  );

-- Delete: super_admin only
CREATE POLICY "institutions_delete" ON institutions
  FOR DELETE USING (
    auth_active_role() = 'super_admin'
  );

-- ────────────────────────────────────────────────────────────
-- TENANTS  (certificate branding)
-- ────────────────────────────────────────────────────────────
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenants_read" ON tenants
  FOR SELECT USING (
    auth_active_role() IN ('admin', 'super_admin')
    OR (
      id = auth_institution_id()
      AND auth_active_role() IN ('tenant_admin', 'tenant_executive', 'candidate')
    )
  );

CREATE POLICY "tenants_create" ON tenants
  FOR INSERT WITH CHECK (
    auth_active_role() = 'super_admin'
  );

CREATE POLICY "tenants_update" ON tenants
  FOR UPDATE USING (
    auth_active_role() IN ('admin', 'super_admin')
    OR (id = auth_institution_id() AND auth_active_role() = 'tenant_admin')
  );

CREATE POLICY "tenants_delete" ON tenants
  FOR DELETE USING (
    auth_active_role() = 'super_admin'
  );

-- ────────────────────────────────────────────────────────────
-- USERS
-- ────────────────────────────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Read: own row, OR admin/super_admin, OR tenant_admin can see users in their institution
CREATE POLICY "users_read" ON users
  FOR SELECT USING (
    id = auth.uid()
    OR auth_active_role() IN ('admin', 'super_admin')
    OR (
      auth_active_role() = 'tenant_admin'
      AND EXISTS (
        SELECT 1 FROM tenant_users tu
        WHERE tu.user_id = users.id
          AND tu.institution_id = auth_institution_id()
      )
    )
  );

-- No direct create via RLS (users are created through auth.users trigger)
CREATE POLICY "users_create" ON users
  FOR INSERT WITH CHECK (
    id = auth.uid()
    OR auth_active_role() IN ('admin', 'super_admin')
  );

-- Update: own record OR admin/super_admin
CREATE POLICY "users_update" ON users
  FOR UPDATE USING (
    id = auth.uid()
    OR auth_active_role() IN ('admin', 'super_admin')
  );

-- Delete: admin/super_admin only
CREATE POLICY "users_delete" ON users
  FOR DELETE USING (
    auth_active_role() IN ('admin', 'super_admin')
  );

-- ────────────────────────────────────────────────────────────
-- TENANT_USERS
-- ────────────────────────────────────────────────────────────
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;

-- Read: super_admin/admin see all; tenant roles see their institution; user sees own record
CREATE POLICY "tenant_users_read" ON tenant_users
  FOR SELECT USING (
    auth_active_role() IN ('super_admin', 'admin')
    OR (
      institution_id = auth_institution_id()
      AND auth_active_role() IN ('tenant_admin', 'tenant_executive', 'proctor', 'examiner')
    )
    OR user_id = auth.uid()
  );

-- Create: super_admin, admin, or tenant_admin
CREATE POLICY "tenant_users_create" ON tenant_users
  FOR INSERT WITH CHECK (
    auth_active_role() IN ('super_admin', 'admin', 'tenant_admin')
  );

-- Update: super_admin/admin OR tenant_admin of same institution
CREATE POLICY "tenant_users_update" ON tenant_users
  FOR UPDATE USING (
    auth_active_role() IN ('super_admin', 'admin')
    OR (
      institution_id = auth_institution_id()
      AND auth_active_role() = 'tenant_admin'
    )
  );

-- Delete: super_admin/admin OR tenant_admin of same institution
CREATE POLICY "tenant_users_delete" ON tenant_users
  FOR DELETE USING (
    auth_active_role() IN ('super_admin', 'admin')
    OR (
      institution_id = auth_institution_id()
      AND auth_active_role() = 'tenant_admin'
    )
  );

-- ────────────────────────────────────────────────────────────
-- STUDENTS
-- ────────────────────────────────────────────────────────────
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students_read" ON students
  FOR SELECT USING (
    auth_active_role() IN ('admin', 'super_admin')
    OR (
      institution_id = auth_institution_id()
      AND auth_active_role() IN ('tenant_admin', 'tenant_executive')
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "students_create" ON students
  FOR INSERT WITH CHECK (
    auth_active_role() IN ('admin', 'super_admin')
    OR (
      institution_id = auth_institution_id()
      AND auth_active_role() IN ('tenant_admin', 'tenant_executive')
    )
  );

CREATE POLICY "students_update" ON students
  FOR UPDATE USING (
    auth_active_role() IN ('admin', 'super_admin')
    OR (
      institution_id = auth_institution_id()
      AND auth_active_role() IN ('tenant_admin', 'tenant_executive')
    )
  );

CREATE POLICY "students_delete" ON students
  FOR DELETE USING (
    auth_active_role() IN ('admin', 'super_admin')
    OR (
      institution_id = auth_institution_id()
      AND auth_active_role() = 'tenant_admin'
    )
  );

-- ────────────────────────────────────────────────────────────
-- EXAMS
-- ────────────────────────────────────────────────────────────
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exams_read" ON exams
  FOR SELECT USING (
    auth_active_role() IN ('admin', 'super_admin')
    OR (
      institution_id = auth_institution_id()
      AND auth_active_role() IN ('tenant_admin', 'tenant_executive', 'candidate')
    )
  );

CREATE POLICY "exams_create" ON exams
  FOR INSERT WITH CHECK (
    auth_active_role() IN ('admin', 'super_admin')
    OR (
      institution_id = auth_institution_id()
      AND auth_active_role() IN ('tenant_admin', 'tenant_executive')
    )
  );

CREATE POLICY "exams_update" ON exams
  FOR UPDATE USING (
    auth_active_role() IN ('admin', 'super_admin')
    OR (
      institution_id = auth_institution_id()
      AND auth_active_role() IN ('tenant_admin', 'tenant_executive')
    )
  );

CREATE POLICY "exams_delete" ON exams
  FOR DELETE USING (
    auth_active_role() IN ('admin', 'super_admin')
    OR (
      institution_id = auth_institution_id()
      AND auth_active_role() IN ('tenant_admin', 'tenant_executive')
    )
  );

-- ────────────────────────────────────────────────────────────
-- QUESTIONS
-- ────────────────────────────────────────────────────────────
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "questions_read" ON questions
  FOR SELECT USING (
    auth_active_role() IN ('admin', 'super_admin')
    OR (
      institution_id = auth_institution_id()
      AND auth_active_role() IN ('tenant_admin', 'tenant_executive', 'candidate')
    )
  );

CREATE POLICY "questions_create" ON questions
  FOR INSERT WITH CHECK (
    auth_active_role() IN ('admin', 'super_admin')
    OR (
      institution_id = auth_institution_id()
      AND auth_active_role() IN ('tenant_admin', 'tenant_executive')
    )
  );

CREATE POLICY "questions_update" ON questions
  FOR UPDATE USING (
    auth_active_role() IN ('admin', 'super_admin')
    OR (
      institution_id = auth_institution_id()
      AND auth_active_role() IN ('tenant_admin', 'tenant_executive')
    )
  );

CREATE POLICY "questions_delete" ON questions
  FOR DELETE USING (
    auth_active_role() IN ('admin', 'super_admin')
    OR (
      institution_id = auth_institution_id()
      AND auth_active_role() IN ('tenant_admin', 'tenant_executive')
    )
  );

-- ────────────────────────────────────────────────────────────
-- BANK_QUESTIONS
-- ────────────────────────────────────────────────────────────
ALTER TABLE bank_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_questions_read" ON bank_questions
  FOR SELECT USING (
    auth_active_role() IN ('admin', 'super_admin')
    OR (
      institution_id = auth_institution_id()
      AND auth_active_role() IN ('tenant_admin', 'tenant_executive')
    )
  );

CREATE POLICY "bank_questions_create" ON bank_questions
  FOR INSERT WITH CHECK (
    auth_active_role() IN ('admin', 'super_admin')
    OR (
      institution_id = auth_institution_id()
      AND auth_active_role() IN ('tenant_admin', 'tenant_executive')
    )
  );

CREATE POLICY "bank_questions_update" ON bank_questions
  FOR UPDATE USING (
    auth_active_role() IN ('admin', 'super_admin')
    OR (
      institution_id = auth_institution_id()
      AND auth_active_role() IN ('tenant_admin', 'tenant_executive')
    )
  );

CREATE POLICY "bank_questions_delete" ON bank_questions
  FOR DELETE USING (
    auth_active_role() IN ('admin', 'super_admin')
    OR (
      institution_id = auth_institution_id()
      AND auth_active_role() IN ('tenant_admin', 'tenant_executive')
    )
  );

-- ────────────────────────────────────────────────────────────
-- EXAM_ATTEMPTS
-- ────────────────────────────────────────────────────────────
ALTER TABLE exam_attempts ENABLE ROW LEVEL SECURITY;

-- Candidates can create their own attempts
CREATE POLICY "exam_attempts_create" ON exam_attempts
  FOR INSERT WITH CHECK (
    candidate_id = auth.uid()
    AND tenant_id = auth_institution_id()
    AND auth_active_role() = 'candidate'
  );

-- Read: admin sees all; tenant_admin sees their institution; candidate sees own
CREATE POLICY "exam_attempts_read" ON exam_attempts
  FOR SELECT USING (
    auth_active_role() IN ('admin', 'super_admin')
    OR (
      tenant_id = auth_institution_id()
      AND auth_active_role() = 'tenant_admin'
    )
    OR (
      tenant_id = auth_institution_id()
      AND candidate_id = auth.uid()
    )
  );

-- Update: candidate their own, or tenant_admin of same institution, or super_admin
CREATE POLICY "exam_attempts_update" ON exam_attempts
  FOR UPDATE USING (
    auth_active_role() = 'super_admin'
    OR (
      tenant_id = auth_institution_id()
      AND candidate_id = auth.uid()
    )
    OR (
      tenant_id = auth_institution_id()
      AND auth_active_role() = 'tenant_admin'
    )
  );

-- Delete: super_admin or tenant_admin
CREATE POLICY "exam_attempts_delete" ON exam_attempts
  FOR DELETE USING (
    auth_active_role() = 'super_admin'
    OR (
      tenant_id = auth_institution_id()
      AND auth_active_role() = 'tenant_admin'
    )
  );

-- ────────────────────────────────────────────────────────────
-- EXAM_TOKENS
-- ────────────────────────────────────────────────────────────
ALTER TABLE exam_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exam_tokens_read" ON exam_tokens
  FOR SELECT USING (
    auth_active_role() IN ('admin', 'super_admin')
    OR (
      tenant_id = auth_institution_id()
      AND auth_active_role() IN ('tenant_admin', 'tenant_executive')
    )
    OR (
      candidate_email = (SELECT email FROM users WHERE id = auth.uid())
      AND tenant_id = auth_institution_id()
      AND auth_active_role() = 'candidate'
    )
  );

CREATE POLICY "exam_tokens_create" ON exam_tokens
  FOR INSERT WITH CHECK (
    auth_active_role() IN ('admin', 'super_admin')
    OR (
      tenant_id = auth_institution_id()
      AND auth_active_role() = 'tenant_admin'
    )
  );

CREATE POLICY "exam_tokens_update" ON exam_tokens
  FOR UPDATE USING (
    auth_active_role() IN ('admin', 'super_admin')
    OR (
      tenant_id = auth_institution_id()
      AND auth_active_role() = 'tenant_admin'
    )
  );

CREATE POLICY "exam_tokens_delete" ON exam_tokens
  FOR DELETE USING (
    auth_active_role() IN ('admin', 'super_admin')
    OR (
      tenant_id = auth_institution_id()
      AND auth_active_role() = 'tenant_admin'
    )
  );

-- ────────────────────────────────────────────────────────────
-- RESULTS
-- NOTE: Create is service-role only (via Express backend, bypasses RLS)
-- ────────────────────────────────────────────────────────────
ALTER TABLE results ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS entirely for create/update of results
-- But we still define read policies for the frontend

CREATE POLICY "results_read" ON results
  FOR SELECT USING (
    auth_active_role() IN ('admin', 'super_admin')
    OR (
      institution_id = auth_institution_id()
      AND auth_active_role() IN ('tenant_admin', 'tenant_executive')
    )
    OR (
      institution_id = auth_institution_id()
      AND candidate_id = auth.uid()
      AND auth_active_role() = 'candidate'
    )
  );

CREATE POLICY "results_update" ON results
  FOR UPDATE USING (
    auth_active_role() IN ('admin', 'super_admin')
    OR (
      institution_id = auth_institution_id()
      AND auth_active_role() = 'tenant_admin'
    )
  );

CREATE POLICY "results_delete" ON results
  FOR DELETE USING (
    auth_active_role() IN ('admin', 'super_admin')
    OR (
      institution_id = auth_institution_id()
      AND auth_active_role() = 'tenant_admin'
    )
  );

-- ────────────────────────────────────────────────────────────
-- VIOLATIONS
-- NOTE: Create is service-role only (via Express backend /api/violations)
-- ────────────────────────────────────────────────────────────
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "violations_read" ON violations
  FOR SELECT USING (
    auth_active_role() IN ('admin', 'super_admin')
    OR (
      institution_id = auth_institution_id()
      AND auth_active_role() IN ('tenant_admin', 'tenant_executive')
    )
  );

CREATE POLICY "violations_update" ON violations
  FOR UPDATE USING (
    auth_active_role() IN ('admin', 'super_admin')
    OR (
      institution_id = auth_institution_id()
      AND auth_active_role() = 'tenant_admin'
    )
  );

CREATE POLICY "violations_delete" ON violations
  FOR DELETE USING (
    auth_active_role() IN ('admin', 'super_admin')
    OR (
      institution_id = auth_institution_id()
      AND auth_active_role() = 'tenant_admin'
    )
  );

-- ────────────────────────────────────────────────────────────
-- STORAGE BUCKET for certificates
-- Run this separately in Supabase dashboard or via CLI
-- ────────────────────────────────────────────────────────────
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('certificates', 'certificates', false);
--
-- CREATE POLICY "certificates_read" ON storage.objects
--   FOR SELECT USING (bucket_id = 'certificates' AND auth.role() = 'authenticated');
