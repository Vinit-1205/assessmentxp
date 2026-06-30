-- ================================================================
-- FIX: Activate ALL pending tenant_admin accounts
-- Run this ONCE in Supabase Dashboard → SQL Editor
-- This fixes any account created before the signup flow was corrected.
-- ================================================================

-- Step 1: Activate ALL pending tenant_users rows (any role = tenant_admin)
UPDATE public.tenant_users
SET is_active = true
WHERE role = 'tenant_admin'
  AND is_active = false;

-- Step 2: Approve ALL Pending institutions (linked to those tenant admins)
UPDATE public.institutions
SET status = 'Active'
WHERE status = 'Pending'
  AND id IN (
    SELECT DISTINCT institution_id
    FROM public.tenant_users
    WHERE role = 'tenant_admin'
  );

-- Step 3: Update the JWT app_metadata for ALL affected users
-- so the backend immediately sees active_role = 'tenant_admin'
UPDATE auth.users au
SET app_metadata = jsonb_set(
  jsonb_set(
    COALESCE(au.app_metadata, '{}'::jsonb),
    '{active_role}',
    '"tenant_admin"'
  ),
  '{institution_id}',
  to_jsonb((
    SELECT institution_id::text
    FROM public.tenant_users
    WHERE user_id = au.id
      AND role = 'tenant_admin'
    LIMIT 1
  ))
)
WHERE au.id IN (
  SELECT user_id
  FROM public.tenant_users
  WHERE role = 'tenant_admin'
    AND user_id IS NOT NULL
)
AND (au.app_metadata->>'active_role' = 'pending_approval'
  OR au.app_metadata->>'active_role' IS NULL);

-- Verify: show the result
SELECT
  tu.email,
  tu.role,
  tu.is_active,
  i.name AS institution_name,
  i.status AS institution_status,
  au.app_metadata->>'active_role' AS jwt_active_role
FROM public.tenant_users tu
JOIN public.institutions i ON i.id = tu.institution_id
JOIN auth.users au ON au.id = tu.user_id
WHERE tu.role = 'tenant_admin';




-- Forbidden: your current active_role is 'pending_approval'. Only tenant_admin, tenant_executive, super_admin or admin may invite users. Check that your institution is approved and your tenant_users.is_active = true.