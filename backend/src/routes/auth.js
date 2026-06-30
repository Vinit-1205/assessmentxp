const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper: Normalize a domain
function normalizeDomain(value) {
  if (!value) return null;
  let v = String(value).trim().toLowerCase();
  v = v.replace(/^https?:\/\//i, '');
  v = v.replace(/^www\./i, '');
  v = v.replace(/\/+$/, '');
  return v || null;
}

// ────────────────────────────────────────────────────────────
// POST /api/signup-tenant-admin
// ────────────────────────────────────────────────────────────
router.post('/signup-tenant-admin', async (req, res) => {
  const { name, slug, domain, website, country, phone, address, location, student_volume, logo_url, email } = req.body;

  if (!name || !slug || !country || !phone || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // 1. Check for duplicates in institutions
    const { data: existing, error: checkError } = await supabase
      .from('institutions')
      .select('*')
      .or(`slug.eq.${slug},domain.eq.${domain || '___'}`);

    if (checkError) throw checkError;

    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'An institution with this slug or domain already exists.' });
    }

    // 2. Create the institution — mark Active immediately so the admin can log in
    const { data: institution, error: instError } = await supabase
      .from('institutions')
      .insert({
        name,
        slug,
        domain: normalizeDomain(domain),
        website: normalizeDomain(website),
        country,
        phone,
        address,
        location,
        student_volume: student_volume ? String(student_volume) : null,
        logo_url,
        status: 'Active',
        is_active: true
      })
      .select()
      .single();

    if (instError) throw instError;

    // 3. Find user in auth.users by email
    const { data: users, error: findError } = await supabase.auth.admin.listUsers();
    if (findError) throw findError;

    const targetUser = users.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    let userId = targetUser ? targetUser.id : null;

    // 4. Create TenantUser entry — active immediately
    const { data: tenantUser, error: tuError } = await supabase
      .from('tenant_users')
      .insert({
        user_id: userId,
        email: email.toLowerCase(),
        institution_id: institution.id,
        role: 'tenant_admin',
        is_active: true
      })
      .select()
      .single();

    if (tuError) {
      // Rollback institution creation
      await supabase.from('institutions').delete().eq('id', institution.id);
      throw tuError;
    }

    // 5. Update the user's JWT metadata so the backend immediately sees active_role = 'tenant_admin'
    if (userId) {
      await supabase.auth.admin.updateUserById(userId, {
        app_metadata: {
          role: 'user',
          active_role: 'tenant_admin',
          institution_id: institution.id
        }
      });
    }

    res.json({
      success: true,
      institution_id: institution.id,
      tenant_user_id: tenantUser.id
    });
  } catch (err) {
    console.error('[signup-tenant-admin] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────
// POST /api/login-with-exam-token
// ────────────────────────────────────────────────────────────
router.post('/login-with-exam-token', async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  try {
    // 1. Look up token in exam_tokens
    const { data: examToken, error: tokenError } = await supabase
      .from('exam_tokens')
      .select('*')
      .eq('token', token.trim().toUpperCase())
      .single();

    if (tokenError || !examToken) {
      return res.status(400).json({ error: 'Invalid or expired exam token' });
    }

    if (examToken.status === 'used') {
      return res.status(400).json({ error: 'This exam token has already been used' });
    }

    const email = examToken.candidate_email.toLowerCase();
    const tempPassword = `${token.trim().toUpperCase()}ExamPass123!`;

    // 2. Look up or create candidate user in auth
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;

    let authUser = listData.users.find(u => u.email.toLowerCase() === email);

    if (!authUser) {
      // Create user
      const { data: newAuthUser, error: createError } = await supabase.auth.admin.createUser({
        email: email,
        password: tempPassword,
        email_confirm: true,
        app_metadata: {
          role: 'user',
          active_role: 'candidate',
          institution_id: examToken.tenant_id
        },
        user_metadata: {
          full_name: email.split('@')[0]
        }
      });
      if (createError) throw createError;
      authUser = newAuthUser.user;
    } else {
      // User exists. Update password & metadata to support this session
      const { error: updateError } = await supabase.auth.admin.updateUserById(authUser.id, {
        password: tempPassword,
        app_metadata: {
          role: 'user',
          active_role: 'candidate',
          institution_id: examToken.tenant_id
        }
      });
      if (updateError) throw updateError;
    }

    // 3. Ensure a Student profile exists
    const { data: existingStudent } = await supabase
      .from('students')
      .select('*')
      .eq('user_id', authUser.id)
      .single();

    if (!existingStudent) {
      await supabase.from('students').insert({
        institution_id: examToken.tenant_id,
        user_id: authUser.id,
        status: 'active'
      });
    }

    // 4. Sign in with the temporary password from backend to retrieve real session
    const clientSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });

    const { data: signInData, error: signInError } = await clientSupabase.auth.signInWithPassword({
      email: email,
      password: tempPassword
    });

    if (signInError) throw signInError;

    // 5. Update token to used
    await supabase
      .from('exam_tokens')
      .update({ status: 'used' })
      .eq('id', examToken.id);

    res.json({
      success: true,
      exam_id: examToken.exam_id,
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token
    });
  } catch (err) {
    console.error('[login-with-exam-token] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────
// POST /api/login-with-token  (magic link token login)
// ────────────────────────────────────────────────────────────
router.post('/login-with-token', async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  try {
    // Try to find if this is an exam token first
    const { data: examToken } = await supabase
      .from('exam_tokens')
      .select('*')
      .eq('token', token.trim().toUpperCase())
      .single();

    if (examToken) {
      // Forward to exam token login logic
      return res.redirect(307, '/api/login-with-exam-token');
    }

    // Otherwise, assume it is a standard magic link verification
    const { data: sessionData, error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: 'magiclink'
    });

    if (error) throw error;

    res.json({
      success: true,
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token
    });
  } catch (err) {
    console.error('[login-with-token] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
