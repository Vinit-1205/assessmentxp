-- ============================================================
-- DEVELOPMENT ONLY: Disable RLS and Grant Full Access
-- DO NOT RUN THIS IN PRODUCTION!
-- This script relaxes all restrictions on the public schema.
-- ============================================================

-- 1. Disable Row Level Security (RLS) on all tables
ALTER TABLE public.institutions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.students DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attempts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_tokens DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.results DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.violations DISABLE ROW LEVEL SECURITY;

-- 2. Grant full CRUD permissions to service_role, postgres, authenticated, and anonymous API roles
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role, postgres, authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role, postgres, authenticated, anon;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role, postgres, authenticated, anon;

-- Ensure default privileges for any future tables created during development
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role, postgres, authenticated, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role, postgres, authenticated, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role, postgres, authenticated, anon;
