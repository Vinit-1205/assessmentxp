import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

export default function ProtectedRoute({
  fallback = <DefaultFallback />,
  unauthenticatedElement = <Navigate to="/" replace />,
}) {
  const { user, isLoadingAuth, isLoadingPublicSettings } = useAuth();

  // Wait until BOTH the initial public-settings check AND the auth check are fully done.
  // While loading, render the fallback — NEVER redirect during loading.
  if (isLoadingAuth || isLoadingPublicSettings) {
    return fallback;
  }

  // Only redirect when loading is fully complete AND user is strictly null/undefined.
  if (!user) {
    return unauthenticatedElement;
  }

  return <Outlet />;
}