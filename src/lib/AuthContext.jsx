import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { supabase } from '@/api/supabaseClient';
import { entities } from '@/api/entities';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState({ id: 'assessmentxp' });

  // Ref that stays true once a user is fully resolved — avoids stale-closure bug
  // where the SIGNED_IN guard (event === 'SIGNED_IN' && user) always sees user=null.
  const userLoadedRef = useRef(false);

  useEffect(() => {
    // 1. Check the current session immediately on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        resolveUserFromSession(session);
      } else {
        setIsLoadingAuth(false);
        setAuthChecked(true);
      }
    });

    // 2. Subscribe to auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Supabase fires TOKEN_REFRESHED and SIGNED_IN both when you switch back
        // to the tab (_onVisibilityChanged → _recoverAndRefresh).
        // Guard using a ref (not state) to avoid stale-closure always seeing user=null.
        if (event === 'TOKEN_REFRESHED') return;
        if (event === 'SIGNED_IN' && userLoadedRef.current) return;

        if (session) {
          await resolveUserFromSession(session);
        } else {
          setUser(null);
          setIsAuthenticated(false);
          setAuthChecked(true);
          setIsLoadingAuth(false);
        }
      }
    );

    return () => subscription?.unsubscribe();
  }, []);

  /**
   * Given a live Supabase session, load the user's TenantUser record
   * to determine their active role and institution_id.
   *
   * Sets the same `user` shape that the rest of the app expects:
   * {
   *   id, email, full_name, role,
   *   activeRoles: [{ role, institution_id }],
   *   institution_id: string | null,
   *   activeRole: string,
   * }
   */
  const resolveUserFromSession = async (session) => {
    // Only show the loading spinner when we have no user yet (first load / after logout).
    // If a user is already set, update silently so pages (especially CandidateExam)
    // are NOT unmounted and restarted by the loading state.
    if (!user) {
      setIsLoadingAuth(true);
    }
    setAuthError(null);
    try {
      const authUser = session.user;

      // Pull profile from public.users table
      let profile = null;
      try {
        profile = await entities.User.get(authUser.id);
      } catch (e) {
        // Profile might not exist yet (race after signup trigger)
        console.warn('[AuthContext] Could not load profile row:', e.message);
      }

      const baseUser = {
        id: authUser.id,
        email: authUser.email,
        full_name: profile?.full_name || authUser.user_metadata?.full_name || '',
        role: profile?.role || authUser.app_metadata?.role || 'user',
      };

      // Check app_metadata for claims set by the backend at login
      const appMeta = authUser.app_metadata || {};
      const metaRole = appMeta.active_role;
      const metaInstitutionId = appMeta.institution_id;

      let activeRoles = [];
      let activeInstitutionId = metaInstitutionId || null;
      let activeRole = metaRole || null;

      // Super admins / platform admins — skip TenantUser lookup
      if (baseUser.role === 'admin' || baseUser.role === 'super_admin') {
        activeRoles = [{ role: baseUser.role }];
        activeRole = baseUser.role;
        if (!activeInstitutionId) {
          try {
            const institutions = await entities.Institution.filter({}, '-created_date', 1);
            if (institutions.length > 0) activeInstitutionId = institutions[0].id;
          } catch (_) { /* no institutions yet */ }
        }
      } else {
        // Load TenantUser records to determine role + institution
        try {
          const tenantUsers = await entities.TenantUser.filter({ user_id: authUser.id, is_active: true });
          activeRoles = tenantUsers;

          if (tenantUsers.length > 0) {
            // Prefer tenant_admin > tenant_executive > first record
            const preferredRecord =
              tenantUsers.find(t => t.role === 'tenant_admin' || t.role === 'tenant_executive') ||
              tenantUsers[0];

            activeInstitutionId = preferredRecord.institution_id;
            activeRole = preferredRecord.role;

            // Check institution approval status
            if (activeInstitutionId) {
              try {
                const institution = await entities.Institution.get(activeInstitutionId);
                if (institution?.status === 'Pending') {
                  activeRole = 'pending_approval';
                }
              } catch (e) {
                console.warn('[AuthContext] Failed to check institution status:', e.message);
              }
            }
          }
          // else: user has no TenantUser records yet → goes to /setup
        } catch (e) {
          console.warn('[AuthContext] Failed to load TenantUser records:', e.message);
        }
      }

      setUser({
        ...baseUser,
        activeRoles,
        institution_id: activeInstitutionId,
        activeRole: activeRole || baseUser.role,
        // Keep tenant_id alias used in some pages
        tenant_id: activeInstitutionId,
      });
      userLoadedRef.current = true; // Mark as loaded so tab-switch SIGNED_IN is skipped
      setIsAuthenticated(true);
    } catch (error) {
      console.error('[AuthContext] resolveUserFromSession failed:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'Failed to load user session',
      });
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  /** Re-run the session resolution (called after SetupWizard completes) */
  const checkUserAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await resolveUserFromSession(session);
    }
  };

  /** Sign out and clear state */
  const logout = async (shouldRedirect = true) => {
    userLoadedRef.current = false; // Allow re-resolution on next login
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect) {
      window.location.href = '/';
    }
  };

  /** Redirect to login page (kept for backward compatibility with components that call this) */
  const navigateToLogin = () => {
    window.location.href = '/';
  };

  /** Stub: kept to satisfy components that check appPublicSettings */
  const checkAppState = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await resolveUserFromSession(session);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};