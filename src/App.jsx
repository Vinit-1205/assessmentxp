import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import Layout from './components/Layout';
import CandidateLayout from './components/CandidateLayout';
import CandidateDashboard from './pages/CandidateDashboard';
import StudentProfile from './pages/StudentProfile';
import HelpSupport from './pages/HelpSupport';
import TenantAdminDashboard from './pages/TenantAdminDashboard';
import StaffManagement from './pages/StaffManagement';
import Reports from './pages/Reports';
import SuperAdminConsole from './pages/SuperAdminConsole';
import ExamBuilder from './pages/ExamBuilder';
import CandidateManagement from './pages/CandidateManagement';
import Analytics from './pages/Analytics';
import CandidateExam from './pages/CandidateExam';
import PostExamAudit from './pages/PostExamAudit';
import ProctoringReview from './pages/ProctoringReview';
import QuestionBank from './pages/QuestionBank';
import ExamDeployment from './pages/ExamDeployment';
import CertificateBranding from './pages/CertificateBranding';
import Login from './pages/Login';
import VerifyCertificate from './pages/VerifyCertificate';
import Signup from './pages/Signup';
import SetupWizard from './pages/SetupWizard';
import PendingApproval from './pages/PendingApproval';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

// Role-based router: only mounted under ProtectedRoute, so `user` is guaranteed non-null here.
const RoleBasedRouter = () => {
  const { user } = useAuth();

  if (!user.activeRoles || user.activeRoles.length === 0) {
    return <Navigate to="/setup" replace />;
  }

  const roles = user.activeRoles.map(r => r.role);

  if (roles.includes('pending_approval')) {
    return (
      <Routes>
        <Route path="/pending-approval" element={<PendingApproval />} />
        <Route path="*" element={<Navigate to="/pending-approval" replace />} />
      </Routes>
    );
  }

  if (roles.includes('super_admin') || roles.includes('admin')) {
    return (
      <Routes>
        <Route path="/super-admin" element={<SuperAdminConsole />} />

        <Route element={<Layout />}>
          <Route path="/dashboard" element={<TenantAdminDashboard />} />
          <Route path="/tenant-dashboard" element={<TenantAdminDashboard />} />
          <Route path="/exam-builder" element={<ExamBuilder />} />
          <Route path="/candidates" element={<CandidateManagement />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/audit" element={<PostExamAudit />} />
          <Route path="/proctoring-review" element={<ProctoringReview />} />
          <Route path="/question-bank" element={<QuestionBank />} />
          <Route path="/deploy-exam" element={<ExamDeployment />} />
          <Route path="/certificate-branding" element={<CertificateBranding />} />
          <Route path="/staff" element={<StaffManagement />} />
          <Route path="/reports" element={<Reports />} />
        </Route>

        <Route element={<CandidateLayout />}>
          <Route path="/candidate-dashboard" element={<CandidateDashboard />} />
          <Route path="/profile" element={<StudentProfile />} />
          <Route path="/support" element={<HelpSupport />} />
        </Route>
        <Route path="/exam/:examId" element={<CandidateExam />} />

        <Route path="*" element={<Navigate to="/super-admin" replace />} />
      </Routes>
    );
  }

  if (roles.includes('candidate')) {
    return (
      <Routes>
        <Route element={<CandidateLayout />}>
          <Route path="/dashboard" element={<CandidateDashboard />} />
          <Route path="/profile" element={<StudentProfile />} />
          <Route path="/support" element={<HelpSupport />} />
        </Route>
        <Route path="/exam/:examId" element={<CandidateExam />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    );
  }

  if (roles.includes('tenant_admin') || roles.includes('tenant_executive')) {
    return (
      <Routes>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<TenantAdminDashboard />} />
          <Route path="/tenant-dashboard" element={<TenantAdminDashboard />} />
          <Route path="/exam-builder" element={<ExamBuilder />} />
          <Route path="/candidates" element={<CandidateManagement />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/audit" element={<PostExamAudit />} />
          <Route path="/proctoring-review" element={<ProctoringReview />} />
          <Route path="/question-bank" element={<QuestionBank />} />
          <Route path="/deploy-exam" element={<ExamDeployment />} />
          <Route path="/certificate-branding" element={<CertificateBranding />} />
          <Route path="/staff" element={<StaffManagement />} />
          <Route path="/reports" element={<Reports />} />
        </Route>
        <Route path="/exam/:examId" element={<CandidateExam />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    );
  }

  // Authenticated but role is not recognized
  return <UserNotRegisteredError />;
};

// Public root: if already logged in, send to dashboard; otherwise show Login.
const PublicRoot = () => {
  const { user, isLoadingAuth, isLoadingPublicSettings } = useAuth();

  if (isLoadingAuth || isLoadingPublicSettings) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Login />;
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <Routes>
            {/* ---------- PUBLIC ROUTES (no auth gate) ---------- */}
            <Route path="/" element={<PublicRoot />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify/:credential_id" element={<VerifyCertificate />} />

            {/* ---------- PROTECTED ROUTES (everything else, role-based) ---------- */}
            <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/" replace />} />}>
              <Route path="/setup" element={<SetupWizard />} />
              <Route path="/*" element={<RoleBasedRouter />} />
            </Route>
          </Routes>
        </Router>
        <Toaster />
        <SonnerToaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App;