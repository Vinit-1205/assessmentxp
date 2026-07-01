import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;
if (!API_URL) {
  throw new Error('VITE_API_URL is not configured');
}

const authHandlers = [];

function notifyAuthChange(event, session) {
  for (const handler of authHandlers) {
    try {
      handler(event, session);
    } catch (e) {
      console.error('[supabaseClient] auth listener error:', e);
    }
  }
}

// Fluent frontend query builder that sends data to backend /api/db-query proxy
class FrontendQueryBuilder {
  constructor(table) {
    this.table = table;
    this.action = 'select';
    this.selectCols = '*';
    this.whereConditions = [];
    this.orExpr = null;
    this.orderCol = null;
    this.orderAsc = true;
    this.limitVal = null;
    this.dataToSave = null;
    this.isSingle = false;
    this.isMaybeSingle = false;
  }

  select(columns = '*') {
    if (this.action !== 'insert' && this.action !== 'update' && this.action !== 'delete') {
      this.action = 'select';
    }
    this.selectCols = columns;
    return this;
  }

  insert(data) {
    this.action = 'insert';
    this.dataToSave = data;
    return this;
  }

  update(data) {
    this.action = 'update';
    this.dataToSave = data;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  eq(col, val) {
    this.whereConditions.push({ col, val });
    return this;
  }

  or(expr) {
    this.orExpr = expr;
    return this;
  }

  order(col, { ascending = true } = {}) {
    this.orderCol = col;
    this.orderAsc = ascending;
    return this;
  }

  limit(val) {
    this.limitVal = val;
    return this;
  }

  match(obj) {
    if (obj) {
      for (const [key, val] of Object.entries(obj)) {
        if (val !== undefined && val !== null) {
          this.eq(key, val);
        }
      }
    }
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  async execute() {
    const token = localStorage.getItem('supabase_access_token');
    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await axios.post(`${API_URL}/api/db-query`, {
        table: this.table,
        action: this.action,
        selectCols: this.selectCols,
        where: this.whereConditions,
        orExpr: this.orExpr,
        order: this.orderCol ? { col: this.orderCol, ascending: this.orderAsc } : null,
        limit: this.limitVal,
        data: this.dataToSave,
        isSingle: this.isSingle,
        isMaybeSingle: this.isMaybeSingle
      }, { headers });

      return response.data;
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      return { data: null, error: new Error(msg) };
    }
  }

  async then(onfulfilled, onrejected) {
    try {
      const res = await this.execute();
      return onfulfilled(res);
    } catch (err) {
      if (onrejected) return onrejected(err);
      throw err;
    }
  }
}

export const supabase = {
  auth: {
    signUp: async ({ email, password, options }) => {
      try {
        const response = await axios.post(`${API_URL}/api/signup-tenant-admin-auth-mock`, {
          email,
          password,
          options
        });
        return response.data;
      } catch (err) {
        return { data: null, error: new Error(err.response?.data?.error || err.message) };
      }
    },

    signInWithPassword: async ({ email, password }) => {
      try {
        const response = await axios.post(`${API_URL}/api/signin-auth-mock`, {
          email,
          password
        });
        const { data, error } = response.data;
        if (error) throw new Error(error.message);
        
        if (data?.session?.access_token) {
          localStorage.setItem('supabase_access_token', data.session.access_token);
          localStorage.setItem('supabase_user', JSON.stringify(data.user));
          notifyAuthChange('SIGNED_IN', data.session);
        }
        return { data, error: null };
      } catch (err) {
        return { data: null, error: new Error(err.response?.data?.error || err.message) };
      }
    },

    verifyOtp: async ({ email, token, type }) => {
      try {
        const response = await axios.post(`${API_URL}/api/verify-otp-auth-mock`, {
          email,
          token,
          type
        });
        const { data, error } = response.data;
        if (error) throw new Error(error.message);

        if (data?.session?.access_token) {
          localStorage.setItem('supabase_access_token', data.session.access_token);
          localStorage.setItem('supabase_user', JSON.stringify(data.user));
          notifyAuthChange('SIGNED_IN', data.session);
        }
        return { data, error: null };
      } catch (err) {
        return { data: null, error: new Error(err.response?.data?.error || err.message) };
      }
    },

    resend: async ({ type, email }) => {
      try {
        const response = await axios.post(`${API_URL}/api/resend-otp-auth-mock`, {
          type,
          email
        });
        return response.data;
      } catch (err) {
        return { data: null, error: new Error(err.response?.data?.error || err.message) };
      }
    },

    resetPasswordForEmail: async (email, { redirectTo }) => {
      try {
        const response = await axios.post(`${API_URL}/api/reset-password-request-mock`, {
          email,
          redirectTo
        });
        return response.data;
      } catch (err) {
        return { data: null, error: new Error(err.response?.data?.error || err.message) };
      }
    },

    updateUser: async ({ password }) => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        const accessToken = localStorage.getItem('supabase_access_token');
        
        const headers = {};
        if (accessToken) {
          headers.Authorization = `Bearer ${accessToken}`;
        }

        const response = await axios.post(`${API_URL}/api/update-user-mock`, {
          password,
          token
        }, { headers });
        
        return response.data;
      } catch (err) {
        return { data: null, error: new Error(err.response?.data?.error || err.message) };
      }
    },

    signOut: async () => {
      localStorage.removeItem('supabase_access_token');
      localStorage.removeItem('supabase_user');
      notifyAuthChange('SIGNED_OUT', null);
      return { error: null };
    },

    setSession: async ({ access_token, refresh_token }) => {
      try {
        localStorage.setItem('supabase_access_token', access_token);
        
        // Fetch current user details via the mock update endpoint (which returns profile info)
        const response = await axios.post(`${API_URL}/api/update-user-mock`, {}, {
          headers: { Authorization: `Bearer ${access_token}` }
        });
        
        const user = response.data?.data?.user;
        if (user) {
          localStorage.setItem('supabase_user', JSON.stringify(user));
          notifyAuthChange('SIGNED_IN', { access_token, refresh_token, user });
          return { data: { session: { access_token, refresh_token, user }, user }, error: null };
        }
        return { data: { session: null, user: null }, error: new Error('Failed to load user profile') };
      } catch (err) {
        return { data: { session: null, user: null }, error: new Error(err.response?.data?.error || err.message) };
      }
    },

    getUser: async () => {
      const accessToken = localStorage.getItem('supabase_access_token');
      const userStr = localStorage.getItem('supabase_user');
      if (accessToken && userStr) {
        try {
          const user = JSON.parse(userStr);
          return { data: { user }, error: null };
        } catch (e) {
          return { data: { user: null }, error: e };
        }
      }
      return { data: { user: null }, error: new Error('No active session') };
    },

    getSession: async () => {
      const accessToken = localStorage.getItem('supabase_access_token');
      const userStr = localStorage.getItem('supabase_user');
      if (accessToken && userStr) {
        const user = JSON.parse(userStr);
        return {
          data: {
            session: {
              access_token: accessToken,
              user
            }
          },
          error: null
        };
      }
      return { data: { session: null }, error: null };
    },

    onAuthStateChange: (callback) => {
      authHandlers.push(callback);
      // Run immediately with current status
      const accessToken = localStorage.getItem('supabase_access_token');
      const userStr = localStorage.getItem('supabase_user');
      if (accessToken && userStr) {
        const user = JSON.parse(userStr);
        setTimeout(() => {
          callback('SIGNED_IN', { access_token: accessToken, user });
        }, 0);
      } else {
        setTimeout(() => {
          callback('SIGNED_OUT', null);
        }, 0);
      }
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              const idx = authHandlers.indexOf(callback);
              if (idx !== -1) authHandlers.splice(idx, 1);
            }
          }
        }
      };
    }
  },

  from: (tableName) => new FrontendQueryBuilder(tableName)
};
