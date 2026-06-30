/**
 * apiClient.js — Axios client for calls to the Express backend.
 *
 * Replaces: base44.functions.invoke('functionName', payload)
 * With:     apiClient.post('/function-name', payload)
 *
 * Automatically attaches the Supabase JWT as Authorization: Bearer <token>
 * on every request.
 */

import axios from 'axios';
import { supabase } from '@/api/supabaseClient';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const axiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 30000, // 30 seconds — some functions (cert generation) can be slow
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Request interceptor: inject Supabase JWT ──────────────────
axiosInstance.interceptors.request.use(async (config) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
  } catch (e) {
    console.warn('[apiClient] Could not attach auth token:', e.message);
  }
  return config;
});

// ── Response interceptor: normalize errors ────────────────────
axiosInstance.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'An unknown error occurred';
    const status = error.response?.status;
    const err = new Error(message);
    err.status = status;
    err.data = error.response?.data;
    return Promise.reject(err);
  }
);

export const apiClient = axiosInstance;
