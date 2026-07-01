const express = require('express');
const router = express.Router();
const supabase = require('../db/postgresSupabaseShim');
const authMiddleware = require('../middleware/auth');

// Helper: check if caller has platform admin rights
function adminOnly(req, res, next) {
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

// ────────────────────────────────────────────────────────────
// GET /api/tenant-staff
// ────────────────────────────────────────────────────────────
router.get('/tenant-staff', authMiddleware, async (req, res) => {
  const tenantId = req.user.institution_id;
  if (!tenantId) {
    return res.status(400).json({ error: 'User does not belong to a tenant' });
  }

  try {
    const { data: staff, error } = await supabase
      .from('tenant_users')
      .select('*')
      .eq('institution_id', tenantId);

    if (error) throw error;
    res.json(staff || []);
  } catch (err) {
    console.error('[tenant-staff] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────
// POST /api/invite-user
// Invites a user, assigns metadata, and registers TenantUser
// ────────────────────────────────────────────────────────────
router.post('/invite-user', authMiddleware, async (req, res) => {
  const { email, role: targetRole, full_name } = req.body;
  const targetInstitutionId = req.body.institution_id || req.user.institution_id;

  const allowedRoles = ['tenant_admin', 'tenant_executive', 'super_admin', 'admin'];
  if (!allowedRoles.includes(req.user.active_role)) {
    return res.status(403).json({
      error: `Forbidden: your current active_role is '${req.user.active_role}'. ` +
             `Only tenant_admin, tenant_executive, super_admin or admin may invite users. ` +
             `Check that your institution is approved and your tenant_users.is_active = true.`
    });
  }

  if (!email || !targetRole || !targetInstitutionId) {
    return res.status(400).json({ error: 'Missing parameters: email, role and institution_id are required' });
  }

  try {
    // 1. Invite/Register user via Supabase Auth admin APIs (non-blocking if exists)
    let authUser = null;
    try {
      const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo: process.env.REDIRECT_URL || `${req.protocol}://${req.get('host')}/reset-password`,
        data: {
          full_name: full_name || email.split('@')[0],
          role: 'user'
        }
      });
      if (inviteError) {
        // If user already exists, that is fine — we will query them below
        console.log('[invite-user] User already has login credentials. Updating metadata instead.');
      } else {
        authUser = inviteData.user;
      }
    } catch (e) {
      console.warn('[invite-user] Auth signup warning:', e.message);
    }

    // Wait a brief moment for public.users trigger to run (if new user)
    await new Promise(r => setTimeout(r, 1000));

    // Get the user ID from auth list
    const { data: listData } = await supabase.auth.admin.listUsers();
    const targetUser = listData.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    const userId = targetUser ? targetUser.id : null;

    if (userId) {
      // Set active_role in app_metadata
      await supabase.auth.admin.updateUserById(userId, {
        app_metadata: {
          role: 'user',
          active_role: targetRole,
          institution_id: targetInstitutionId
        }
      });

      // Update full name in public.users profile
      if (full_name) {
        await supabase
          .from('users')
          .update({ full_name })
          .eq('id', userId);
      }
    }

    // 3. Create TenantUser entry
    const { data: existingTenantUser } = await supabase
      .from('tenant_users')
      .select('*')
      .eq('institution_id', targetInstitutionId)
      .eq('email', email.toLowerCase());

    if (!existingTenantUser || existingTenantUser.length === 0) {
      const newTenantUser = {
        email: email.toLowerCase(),
        institution_id: targetInstitutionId,
        role: targetRole,
        is_active: true
      };
      if (userId) newTenantUser.user_id = userId;

      await supabase.from('tenant_users').insert(newTenantUser);
    }

    // 4. Create Student record if role is candidate
    if (targetRole === 'candidate') {
      const studentQuery = supabase.from('students').select('*').eq('institution_id', targetInstitutionId);
      const { data: existingStudent } = userId
        ? await studentQuery.eq('user_id', userId)
        : await studentQuery.eq('student_identifier', email.split('@')[0]);

      if (!existingStudent || existingStudent.length === 0) {
        const newStudent = {
          institution_id: targetInstitutionId,
          student_identifier: email.split('@')[0],
          status: 'active'
        };
        if (userId) newStudent.user_id = userId;

        await supabase.from('students').insert(newStudent);
      }
    }

    // 5. Trigger password reset/recovery email to invite user to set a password
    try {
      await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: email
      });
    } catch (e) {
      console.warn('[invite-user] Failed to trigger recovery email link:', e.message);
    }

    res.json({
      success: true,
      faculty_name: full_name,
      faculty_email: email,
      role: targetRole,
      institution_id: targetInstitutionId,
      message: 'Invitation processed successfully'
    });
  } catch (err) {
    console.error('[invite-user] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────
// GET /api/user-directory
// Platform-wide User Directory (super_admin/admin only)
// ────────────────────────────────────────────────────────────
router.get('/user-directory', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  try {
    // Fetch users, tenant users, and institutions in parallel
    const [
      { data: allUsers, error: usersErr },
      { data: allTenantUsers, error: tuErr },
      { data: allInstitutions, error: instErr }
    ] = await Promise.all([
      supabase.from('users').select('*').order('created_at', { ascending: false }),
      supabase.from('tenant_users').select('*'),
      supabase.from('institutions').select('*')
    ]);

    if (usersErr) throw usersErr;
    if (tuErr) throw tuErr;
    if (instErr) throw instErr;

    // Create lookup mappings
    const instNameMap = {};
    allInstitutions.forEach(i => { instNameMap[i.id] = i.name; });

    const assignmentsByUser = {};
    allTenantUsers.forEach(tu => {
      if (!assignmentsByUser[tu.user_id]) assignmentsByUser[tu.user_id] = [];
      assignmentsByUser[tu.user_id].push({
        role: tu.role,
        institution_name: instNameMap[tu.institution_id] || 'Unknown'
      });
    });

    const directory = allUsers.map(u => {
      const assignments = assignmentsByUser[u.id] || [];

      // Effective persona determination
      let persona = 'Unassigned';
      if (u.role === 'super_admin') persona = 'Super Admin';
      else if (u.role === 'admin') persona = 'Admin';
      else if (assignments.length > 0) {
        const roles = assignments.map(a => a.role);
        if (roles.includes('tenant_admin')) persona = 'Tenant Admin';
        else if (roles.includes('tenant_executive')) persona = 'Tenant Executive';
        else if (roles.includes('candidate')) persona = 'Candidate';
      }

      return {
        id: u.id,
        full_name: u.full_name || '—',
        email: u.email,
        global_role: u.role,
        persona,
        institution_name: assignments[0]?.institution_name || '—',
        tenant_roles: assignments.map(a => a.role),
        created_date: u.created_at || u.created_date
      };
    });

    // Summary count calculations
    const summary = {};
    directory.forEach(d => {
      summary[d.persona] = (summary[d.persona] || 0) + 1;
    });

    res.json({ directory, summary, total: directory.length });
  } catch (err) {
    console.error('[user-directory] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
