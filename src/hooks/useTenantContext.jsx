import { useAuth } from '@/lib/AuthContext';

export function useTenantContext() {
  const { user, isLoadingAuth } = useAuth();

  return {
    user,
    tenantId: user?.institution_id,
    isLoading: isLoadingAuth
  };
}