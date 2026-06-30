/**
 * entities.js — Compatibility shim that mirrors the Base44 SDK entity API
 * using Supabase under the hood.
 *
 * Drop-in replacement: change
 *   import { base44 } from '@/api/base44Client'
 *   base44.entities.Exam.filter({ institution_id: id })
 * to:
 *   import { entities } from '@/api/entities'
 *   entities.Exam.filter({ institution_id: id })
 */

import { supabase } from '@/api/supabaseClient';

/**
 * Parse Base44-style orderBy string (e.g. '-created_date' → { column: 'created_at', ascending: false })
 * Base44 uses 'created_date', Supabase uses 'created_at'.
 */
function parseOrderBy(orderBy) {
  if (!orderBy) return { column: 'created_at', ascending: false };
  const ascending = !orderBy.startsWith('-');
  const raw = orderBy.replace(/^-/, '');
  // Map Base44 field names → Postgres column names
  const fieldMap = {
    created_date: 'created_at',
    updated_date: 'updated_at',
  };
  const column = fieldMap[raw] || raw;
  return { column, ascending };
}

/**
 * Build a Supabase query with .match() + optional ordering + optional limit.
 * Supports nested objects for JSONB array matching (limited — use filter for complex cases).
 */
function applyFilter(query, where) {
  if (!where || typeof where !== 'object') return query;
  const simple = {};
  for (const [key, val] of Object.entries(where)) {
    if (val !== null && val !== undefined && typeof val !== 'object') {
      simple[key] = val;
    } else if (val !== null && val !== undefined) {
      // For boolean false, include it
      if (typeof val === 'boolean') {
        simple[key] = val;
      }
    }
  }
  return query.match(simple);
}

/**
 * Factory: creates an entity accessor for a given Supabase table.
 *
 * @param {string} tableName - Supabase table name
 * @returns {{ filter, get, create, update, delete, bulkCreate }}
 */
function makeEntity(tableName) {
  return {
    /**
     * filter(where, orderBy?, limit?)
     * Returns array of records matching `where`.
     * Mirrors: base44.entities.X.filter({ institution_id: id }, '-created_date', 10)
     */
    filter: async (where = {}, orderBy, limit) => {
      const { column, ascending } = parseOrderBy(orderBy);
      let q = supabase.from(tableName).select('*');
      q = applyFilter(q, where);
      q = q.order(column, { ascending });
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },

    /**
     * get(id)
     * Returns a single record by primary key.
     * Mirrors: base44.entities.X.get(id)
     */
    get: async (id) => {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data; // null if not found, no error thrown
    },

    /**
     * create(data)
     * Inserts a record and returns the inserted row.
     * Mirrors: base44.entities.X.create({ ... })
     */
    create: async (data) => {
      const { data: row, error } = await supabase
        .from(tableName)
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return row;
    },

    /**
     * update(id, data)
     * Updates a record by primary key and returns the updated row.
     * Mirrors: base44.entities.X.update(id, { ... })
     */
    update: async (id, data) => {
      const { data: row, error } = await supabase
        .from(tableName)
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return row;
    },

    /**
     * delete(id)
     * Deletes a record by primary key.
     * Mirrors: base44.entities.X.delete(id)
     */
    delete: async (id) => {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { success: true };
    },

    /**
     * bulkCreate(rows)
     * Inserts multiple records.
     * Mirrors: base44.entities.X.bulkCreate([...])
     */
    bulkCreate: async (rows) => {
      const { data, error } = await supabase
        .from(tableName)
        .insert(rows)
        .select();
      if (error) throw error;
      return data || [];
    },

    /**
     * list()
     * Returns all records (no filter). Used by admin/super_admin functions.
     */
    list: async () => {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Entity map — mirrors all 12 Base44 entities
// Table names map to supabase/migrations/001_initial_schema.sql
// ─────────────────────────────────────────────────────────────
export const entities = {
  Exam:         makeEntity('exams'),
  Question:     makeEntity('questions'),
  BankQuestion: makeEntity('bank_questions'),
  ExamAttempt:  makeEntity('exam_attempts'),
  ExamToken:    makeEntity('exam_tokens'),
  Result:       makeEntity('results'),
  Violation:    makeEntity('violations'),
  Institution:  makeEntity('institutions'),
  Tenant:       makeEntity('tenants'),
  TenantUser:   makeEntity('tenant_users'),
  User:         makeEntity('users'),
  Student:      makeEntity('students'),
  CertificateBranding: makeEntity('certificate_brandings'),
};
