const express = require('express');
const router = express.Router();
const supabase = require('../db/postgresShim');

// ────────────────────────────────────────────────────────────
// GET /api/verify/:credential_id
// Public credential verification endpoint (shares certificates publicly)
// ────────────────────────────────────────────────────────────
router.get('/verify/:credential_id', async (req, res) => {
  const { credential_id } = req.params;

  try {
    // 1. Fetch certificate/result details bypassing RLS
    const { data: result, error: resultError } = await supabase
      .from('results')
      .select('*')
      .eq('id', credential_id)
      .single();

    if (resultError || !result) {
      return res.status(404).json({ valid: false, error: 'Invalid or missing credential' });
    }

    // 2. Fetch associated Exam and User data securely using service role
    const [
      { data: exam },
      { data: candidate }
    ] = await Promise.all([
      supabase.from('exams').select('*').eq('id', result.exam_id).single(),
      supabase.from('users').select('*').eq('id', result.candidate_id).single()
    ]);

    if (!exam || !candidate) {
      return res.status(404).json({ valid: false, error: 'Associated exam or candidate details missing' });
    }

    res.json({
      valid: true,
      credential: {
        id: result.id,
        candidate_name: candidate.full_name || 'Candidate',
        exam_title: exam.title,
        score: result.academic_score,
        status: result.final_result_status,
        issue_date: result.created_at,
        certificate_url: result.certificate_url
      }
    });
  } catch (err) {
    console.error('[verify-public] error:', err.message);
    res.status(500).json({ valid: false, error: 'Credential verification system error' });
  }
});

// ────────────────────────────────────────────────────────────
// GET /api/tenant-branding/:tenant_id
// Public tenant branding endpoint for login pages
// ────────────────────────────────────────────────────────────
router.get('/tenant-branding/:tenant_id', async (req, res) => {
  const { tenant_id } = req.params;

  try {
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('name, logo_url, border_color, primary_color')
      .eq('id', tenant_id)
      .single();

    if (error || !tenant) {
      // Return default branding if not found
      return res.json({
        success: true,
        tenant: {
          name: 'AssessmentXP',
          logo_url: null,
          border_color: '#002147'
        }
      });
    }

    res.json({
      success: true,
      tenant
    });
  } catch (err) {
    console.error('[tenant-branding-public] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
