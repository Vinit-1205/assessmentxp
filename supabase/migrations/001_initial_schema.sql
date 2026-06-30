-- ============================================================
-- AssessmentXP — Initial Schema
-- Migrated from Base44 entity definitions
-- Run this in Supabase SQL Editor or via `supabase db push`
-- ============================================================

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ────────────────────────────────────────────────────────────
-- INSTITUTIONS  (maps to Base44 Institution entity)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS institutions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  domain          TEXT,
  logo_url        TEXT,
  country         TEXT NOT NULL,
  address         TEXT,
  location        TEXT,
  student_volume  TEXT,
  phone           TEXT NOT NULL,
  website         TEXT,
  plan            TEXT NOT NULL DEFAULT 'Starter'
                  CHECK (plan IN ('Starter', 'Professional', 'Enterprise')),
  status          TEXT NOT NULL DEFAULT 'Active'
                  CHECK (status IN ('Active', 'Pending', 'Suspended', 'Inactive')),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- TENANTS  (maps to Base44 Tenant entity — certificate branding)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  domain          TEXT,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'inactive')),
  logo_url        TEXT,
  badge_url       TEXT,
  signature_url   TEXT,
  background_url  TEXT,
  border_color    TEXT DEFAULT '#000000',
  primary_color   TEXT DEFAULT '#1e3a8a',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- USERS  (public profile — extends auth.users)
-- NOTE: Supabase auth.users holds credentials; this table holds profile data.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL UNIQUE,
  full_name       TEXT,
  role            TEXT NOT NULL DEFAULT 'user'
                  CHECK (role IN ('admin', 'super_admin', 'user')),
  tenant_access   JSONB DEFAULT '[]'::jsonb,  -- legacy field, kept for compatibility
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- TENANT_USERS  (maps to Base44 TenantUser — junction table)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  email           TEXT NOT NULL,
  institution_id  UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  role            TEXT NOT NULL
                  CHECK (role IN ('super_admin', 'admin', 'tenant_admin', 'tenant_executive',
                                  'candidate', 'proctor', 'examiner')),
  department      TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_users_user_id ON tenant_users(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_institution_id ON tenant_users(institution_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_email ON tenant_users(email);

-- ────────────────────────────────────────────────────────────
-- STUDENTS  (maps to Base44 Student entity)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS students (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id      UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  user_id             UUID REFERENCES users(id) ON DELETE SET NULL,
  student_identifier  TEXT,
  status              TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'graduated', 'suspended')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_students_institution_id ON students(institution_id);
CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id);

-- ────────────────────────────────────────────────────────────
-- EXAMS  (maps to Base44 Exam entity)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exams (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id          UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  title                   TEXT NOT NULL,
  course_id               TEXT,
  description             TEXT,
  duration_minutes        INTEGER NOT NULL DEFAULT 60,
  passing_threshold       NUMERIC NOT NULL DEFAULT 50,
  total_marks             NUMERIC NOT NULL DEFAULT 0,
  shuffle_questions       BOOLEAN NOT NULL DEFAULT true,
  shuffle_options         BOOLEAN NOT NULL DEFAULT true,
  status                  TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'published', 'archived')),
  start_date              TEXT,
  start_time              TEXT,
  end_date                TEXT,
  end_time                TEXT,
  max_attempts            INTEGER NOT NULL DEFAULT 1,
  access_code             TEXT,
  allow_early_submission  BOOLEAN NOT NULL DEFAULT true,
  allow_late_join         BOOLEAN NOT NULL DEFAULT false,
  proctoring_strictness   TEXT NOT NULL DEFAULT 'Standard'
                          CHECK (proctoring_strictness IN ('Lenient', 'Standard', 'Strict', 'Ultra')),
  proctoring_modules      JSONB,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exams_institution_id ON exams(institution_id);
CREATE INDEX IF NOT EXISTS idx_exams_status ON exams(status);

-- ────────────────────────────────────────────────────────────
-- QUESTIONS  (maps to Base44 Question entity)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS questions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id        UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  exam_id               UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  text                  TEXT NOT NULL,
  type                  TEXT NOT NULL DEFAULT 'MCQ'
                        CHECK (type IN ('MCQ', 'Short Answer', 'Coding Problem')),
  section               TEXT DEFAULT 'Section A',
  options               TEXT[],           -- Array of option strings
  correct_option_index  INTEGER,
  marks_awarded         NUMERIC DEFAULT 1,
  time_limit            INTEGER,
  explanation           TEXT,
  is_required           BOOLEAN DEFAULT true,
  subject_tag           TEXT,
  difficulty_level      TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_questions_exam_id ON questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_questions_institution_id ON questions(institution_id);

-- ────────────────────────────────────────────────────────────
-- BANK_QUESTIONS  (maps to Base44 BankQuestion entity)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_questions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id   UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  question_text    TEXT NOT NULL,
  option_a         TEXT NOT NULL,
  option_b         TEXT NOT NULL,
  option_c         TEXT NOT NULL,
  option_d         TEXT NOT NULL,
  correct_option   TEXT NOT NULL CHECK (correct_option IN ('A', 'B', 'C', 'D')),
  subject_tag      TEXT,
  difficulty_level TEXT CHECK (difficulty_level IN ('Easy', 'Medium', 'Hard')),
  marks_awarded    NUMERIC,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_questions_institution_id ON bank_questions(institution_id);

-- ────────────────────────────────────────────────────────────
-- EXAM_ATTEMPTS  (maps to Base44 ExamAttempt entity)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exam_attempts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  exam_id               UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  candidate_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  randomized_questions  JSONB NOT NULL DEFAULT '[]'::jsonb,
  answers               JSONB DEFAULT '{}'::jsonb,
  completed             BOOLEAN NOT NULL DEFAULT false,
  time_left             INTEGER NOT NULL DEFAULT 3600,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam_id ON exam_attempts(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_candidate_id ON exam_attempts(candidate_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_tenant_id ON exam_attempts(tenant_id);

-- ────────────────────────────────────────────────────────────
-- EXAM_TOKENS  (maps to Base44 ExamToken entity)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exam_tokens (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  exam_id          UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  candidate_email  TEXT NOT NULL,
  token            TEXT NOT NULL UNIQUE,
  status           TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'used')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exam_tokens_token ON exam_tokens(token);
CREATE INDEX IF NOT EXISTS idx_exam_tokens_exam_id ON exam_tokens(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_tokens_tenant_id ON exam_tokens(tenant_id);

-- ────────────────────────────────────────────────────────────
-- RESULTS  (maps to Base44 Result entity)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS results (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id      UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  tenant_id           UUID REFERENCES institutions(id) ON DELETE SET NULL,
  exam_id             UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  candidate_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score               NUMERIC,
  total_possible_score NUMERIC,
  passed              BOOLEAN,
  academic_score      NUMERIC,
  integrity_score     NUMERIC,
  final_result_status TEXT
                      CHECK (final_result_status IN ('Auto-Approved Pass', 'Pending Admin Review', 'Failed')),
  certificate_url     TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_results_exam_id ON results(exam_id);
CREATE INDEX IF NOT EXISTS idx_results_candidate_id ON results(candidate_id);
CREATE INDEX IF NOT EXISTS idx_results_institution_id ON results(institution_id);

-- ────────────────────────────────────────────────────────────
-- VIOLATIONS  (maps to Base44 Violation entity)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS violations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  exam_id         UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  candidate_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attempt_id      UUID NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  timestamp       TIMESTAMPTZ NOT NULL,
  media_url       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_violations_attempt_id ON violations(attempt_id);
CREATE INDEX IF NOT EXISTS idx_violations_exam_id ON violations(exam_id);
CREATE INDEX IF NOT EXISTS idx_violations_institution_id ON violations(institution_id);

-- ────────────────────────────────────────────────────────────
-- AUTO-UPDATE updated_at TRIGGER
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['institutions','tenants','users','tenant_users',
    'students','exams','questions','bank_questions','exam_attempts',
    'exam_tokens','results']
  LOOP
    EXECUTE format('
      CREATE OR REPLACE TRIGGER trg_%s_updated_at
      BEFORE UPDATE ON %s
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();', t, t);
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────
-- AUTO-CREATE public.users ON auth.users INSERT
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();
