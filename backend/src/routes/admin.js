const express = require('express');
const router = express.Router();
const supabase = require('../db/postgresShim');
const authMiddleware = require('../middleware/auth');

// Helper: Ensure the request is coming from a super_admin/admin
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Forbidden: Super Admin access required' });
  }
  next();
}

// ────────────────────────────────────────────────────────────
// POST /api/provision-tenant
// Super-admin only organization creator
// ────────────────────────────────────────────────────────────
router.post('/provision-tenant', authMiddleware, adminOnly, async (req, res) => {
  const { name, domain } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    const { data: newTenant, error } = await supabase
      .from('tenants')
      .insert({
        name,
        domain: domain || null,
        status: 'active'
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ tenant: newTenant });
  } catch (err) {
    console.error('[provision-tenant] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────
// POST /api/sync-tenant-access
// Synchronizes tenant assignments to app_metadata (called on TenantUser updates)
// ────────────────────────────────────────────────────────────
router.post('/sync-tenant-access', async (req, res) => {
  try {
    let userId = null;

    // Support Supabase Webhook payload
    if (req.body.record) {
      userId = req.body.record.user_id || req.body.old_record?.user_id;
    } else {
      userId = req.body.user_id;
    }

    if (!userId) {
      return res.json({ success: true, message: 'No user_id found to sync' });
    }

    // Fetch all active TenantUser records for this user
    const { data: tenantUsers, error: tuError } = await supabase
      .from('tenant_users')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (tuError) throw tuError;

    const tenantAccess = tenantUsers.map(tu => ({
      institution_id: tu.institution_id,
      role: tu.role
    }));

    // Update public.users record
    await supabase
      .from('users')
      .update({ tenant_access: tenantAccess })
      .eq('id', userId);

    // Update Supabase auth.users metadata and claims
    // We set active_role to the highest privilege role available or candidate
    let activeRole = 'user';
    let institutionId = null;

    if (tenantUsers.length > 0) {
      const preferred =
        tenantUsers.find(t => t.role === 'tenant_admin' || t.role === 'tenant_executive') ||
        tenantUsers[0];
      activeRole = preferred.role;
      institutionId = preferred.institution_id;
    }

    const { error: authUpdateError } = await supabase.auth.admin.updateUserById(userId, {
      app_metadata: {
        role: 'user',
        active_role: activeRole,
        institution_id: institutionId,
        tenant_access: tenantAccess
      }
    });

    if (authUpdateError) throw authUpdateError;

    res.json({ success: true, user_id: userId, tenant_access: tenantAccess });
  } catch (err) {
    console.error('[sync-tenant-access] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────
// GET /api/billing-metrics
// ────────────────────────────────────────────────────────────
router.get('/billing-metrics', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { data: institutions, error: instError } = await supabase.from('institutions').select('*');
    const { data: results, error: resError } = await supabase.from('results').select('*');

    if (instError) throw instError;
    if (resError) throw resError;

    // Compute metrics
    const metrics = {
      total_tenants: institutions.length,
      active_tenants: institutions.filter(i => i.status === 'Active').length,
      exams_completed: results.length,
      estimated_monthly_bill: institutions.length * 15 // Mock calculation formula
    };

    res.json({ success: true, metrics });
  } catch (err) {
    console.error('[billing-metrics] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────
// GET /api/diagnose-tenants
// ────────────────────────────────────────────────────────────
router.get('/diagnose-tenants', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { data: institutions } = await supabase.from('institutions').select('*');
    const { data: tenantUsers } = await supabase.from('tenant_users').select('*');

    const issues = [];
    institutions.forEach(inst => {
      const admins = tenantUsers.filter(tu => tu.institution_id === inst.id && tu.role === 'tenant_admin');
      if (admins.length === 0) {
        issues.push({
          institution_id: inst.id,
          name: inst.name,
          type: 'no_tenant_admin',
          description: 'Institution has no tenant_admin user assigned.'
        });
      }
    });

    res.json({ success: true, issues });
  } catch (err) {
    console.error('[diagnose-tenants] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
