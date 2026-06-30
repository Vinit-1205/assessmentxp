# Migration Task List

## Phase 0 — Database Schema
- [x] Create `supabase/migrations/001_initial_schema.sql` (12 tables)
- [x] Create `supabase/migrations/002_rls_policies.sql` (RLS from 12 jsonc files)
- [x] Create `supabase/migrations/003_dev_disable_rls.sql` (development bypass)
- [x] Create `supabase/migrations/004_prod_enable_rls.sql` (production restore)
- [x] Create `supabase/migrations/005_backfill_and_fix_trigger.sql` (auth trigger fix & backfill)

## Phase 1 — API Client Layer
- [x] Create `src/api/supabaseClient.js`
- [x] Create `src/api/entities.js` (compatibility shim)
- [x] Create `src/api/apiClient.js` (Axios for Express routes)

## Phase 2 — Auth Layer
- [x] Rewrite `src/lib/AuthContext.jsx`
- [x] Update `src/pages/Login.jsx`
- [x] Update `src/pages/Signup.jsx`
- [x] Update `src/pages/ForgotPassword.jsx`
- [x] Update `src/pages/ResetPassword.jsx`
- [x] Update `src/pages/Register.jsx`
- [x] Update `src/lib/app-params.js` (remove or gut)
- [x] Update `src/components/TenantAdminSidebar.jsx`
- [x] Update `src/components/CandidateLayout.jsx`

## Phase 3 — Frontend Pages
- [x] Update `src/pages/CandidateExam.jsx`
- [x] Update `src/pages/SetupWizard.jsx`
- [x] Update `src/pages/CandidateLogin.jsx`
- [x] Update `src/pages/CandidateDashboard.jsx`
- [x] Update `src/pages/TenantAdminDashboard.jsx`
- [x] Update `src/pages/StaffManagement.jsx`
- [x] Update `src/pages/Reports.jsx`
- [x] Update `src/pages/QuestionBank.jsx`
- [x] Update `src/pages/ProctoringReview.jsx`
- [x] Update `src/pages/PostExamAudit.jsx`
- [x] Update `src/pages/ExamDeployment.jsx`
- [x] Update `src/pages/ExamBuilder.jsx`
- [x] Update `src/pages/CertificateBranding.jsx`
- [x] Update `src/pages/CandidateManagement.jsx`
- [x] Update `src/pages/Analytics.jsx`
- [x] Update `src/pages/StudentProfile.jsx`
- [x] Update `src/pages/VerifyCertificate.jsx`
- [x] Update `src/lib/PageNotFound.jsx`
- [x] Update `src/components/superadmin/SAApprovals.jsx`
- [x] Update `src/components/superadmin/UserDirectory.jsx`

## Phase 4 — Express Backend
- [x] Create `backend/package.json`
- [x] Create `backend/.env.example`
- [x] Create `backend/src/index.js`
- [x] Create `backend/src/middleware/auth.js`
- [x] Create `backend/src/routes/auth.js`
- [x] Create `backend/src/routes/exam.js`
- [x] Create `backend/src/routes/result.js`
- [x] Create `backend/src/routes/users.js`
- [x] Create `backend/src/routes/violations.js`
- [x] Create `backend/src/routes/public.js`
- [x] Create `backend/src/routes/admin.js`

## Phase 5 — Config Cleanup
- [x] Update `package.json` (remove base44, add supabase/axios)
- [x] Update `vite.config.js` (remove base44 plugin)
- [x] Update `.env.local` (add Supabase + API URL vars)
- [x] Create `.env.example`
