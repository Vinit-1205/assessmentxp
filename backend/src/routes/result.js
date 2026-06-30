const express = require('express');
const router = express.Router();
const { jsPDF } = require('jspdf');
const { createClient } = require('@supabase/supabase-js');
const authMiddleware = require('../middleware/auth');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper: Fetch image as Base64 for jsPDF
async function fetchImageAsBase64(url) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const mime = response.headers.get('content-type') || 'image/png';
    return `data:${mime};base64,${base64}`;
  } catch (e) {
    console.error('[fetchImageAsBase64] Failed to fetch image:', url, e.message);
    return null;
  }
}

// ────────────────────────────────────────────────────────────
// POST /api/calculate-result
// Supports both Supabase Webhook and direct client call
// ────────────────────────────────────────────────────────────
router.post('/calculate-result', async (req, res) => {
  let attempt = null;

  // 1. Detect if payload is from a Supabase webhook
  if (req.body.record && req.body.type === 'UPDATE') {
    // Supabase standard webhook format
    attempt = req.body.record;
  } else if (req.body.data && req.body.event?.type === 'update') {
    // Legacy base44 webhook format
    attempt = req.body.data;
  } else {
    // Direct client call
    const { attempt_id } = req.body;
    if (attempt_id) {
      const { data, error } = await supabase
        .from('exam_attempts')
        .select('*')
        .eq('id', attempt_id)
        .single();
      if (error) {
        return res.status(404).json({ error: 'Attempt not found' });
      }
      attempt = data;
    }
  }

  if (!attempt || !attempt.completed) {
    return res.json({ status: 'ignored', message: 'Attempt is not completed or missing' });
  }

  try {
    const examId = attempt.exam_id;
    const candidateId = attempt.candidate_id;
    const tenantId = attempt.tenant_id;

    // Check if result already exists to prevent duplicate calculations
    const { data: existingResult } = await supabase
      .from('results')
      .select('*')
      .eq('exam_id', examId)
      .eq('candidate_id', candidateId)
      .single();

    if (existingResult) {
      return res.json({ success: true, message: 'Result already calculated', result: existingResult });
    }

    // Fetch Exam details
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select('*')
      .eq('id', examId)
      .single();

    if (examError || !exam) throw new Error('Exam not found');

    const passingThreshold = exam.passing_threshold || 50;

    // Calculate Academic Score
    const randomizedQuestions = attempt.randomized_questions || [];
    let score = 0;
    let totalPossibleScore = 0;
    const answers = attempt.answers || {};

    randomizedQuestions.forEach(q => {
      const marks = q.marks_awarded || 1;
      totalPossibleScore += marks;
      if (answers[q.id] === q.correct_option_index) {
        score += marks;
      }
    });

    const academicScore = totalPossibleScore > 0 ? (score / totalPossibleScore) * 100 : 0;
    const meetsThreshold = academicScore >= passingThreshold;

    // Calculate Integrity Score
    let integrityScore = 100;
    const { data: violations, error: violationsError } = await supabase
      .from('violations')
      .select('*')
      .eq('attempt_id', attempt.id);

    if (!violationsError && violations) {
      violations.forEach(v => {
        if (v.type && v.type.includes('Focus Loss')) {
          integrityScore -= 5;
        } else if (v.type && v.type.includes('Critical Violation')) {
          integrityScore -= 35;
        }
      });
    }

    if (integrityScore < 0) integrityScore = 0;

    // Determine Final Status
    let finalResultStatus = 'Failed';
    if (integrityScore < 70) {
      finalResultStatus = 'Pending Admin Review';
    } else if (meetsThreshold && integrityScore >= 70) {
      finalResultStatus = 'Auto-Approved Pass';
    }

    // Create the Result record
    const { data: result, error: resultError } = await supabase
      .from('results')
      .insert({
        institution_id: tenantId,
        tenant_id: tenantId,
        exam_id: examId,
        candidate_id: candidateId,
        score: score,
        total_possible_score: totalPossibleScore,
        passed: meetsThreshold,
        academic_score: academicScore,
        integrity_score: integrityScore,
        final_result_status: finalResultStatus
      })
      .select()
      .single();

    if (resultError) throw resultError;

    // If approved pass, trigger certificate generation asynchronously
    if (finalResultStatus === 'Auto-Approved Pass') {
      // Trigger local generate-certificate route via direct invocation (non-blocking)
      fetch(`${req.protocol}://${req.get('host')}/api/generate-certificate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result_id: result.id })
      }).catch(err => console.error('[calculate-result] cert trigger error:', err.message));
    }

    res.json({ success: true, academicScore, integrityScore, finalResultStatus, result });
  } catch (err) {
    console.error('[calculate-result] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────
// POST /api/generate-certificate
// Supports both DB webhook and direct manual backend calls
// ────────────────────────────────────────────────────────────
router.post('/generate-certificate', async (req, res) => {
  let result = null;

  // Support DB webhook format
  if (req.body.record && req.body.type === 'INSERT') {
    result = req.body.record;
  } else if (req.body.data && req.body.event?.type === 'insert') {
    result = req.body.data;
  } else {
    // Direct call with result_id
    const { result_id } = req.body;
    if (result_id) {
      const { data, error } = await supabase
        .from('results')
        .select('*')
        .eq('id', result_id)
        .single();
      if (error) {
        return res.status(404).json({ error: 'Result not found' });
      }
      result = data;
    }
  }

  if (!result || result.final_result_status !== 'Auto-Approved Pass') {
    return res.json({ success: true, message: 'Not an approved pass. Skipping.' });
  }

  if (result.certificate_url) {
    return res.json({ success: true, message: 'Certificate already generated.' });
  }

  try {
    // Fetch user, exam, tenant, and branding
    const [
      { data: candidate },
      { data: exam },
      { data: tenant },
      { data: branding }
    ] = await Promise.all([
      supabase.from('users').select('*').eq('id', result.candidate_id).single(),
      supabase.from('exams').select('*').eq('id', result.exam_id).single(),
      supabase.from('tenants').select('*').eq('id', result.institution_id || result.tenant_id).single(),
      supabase.from('certificate_brandings').select('*').eq('tenant_id', result.institution_id || result.tenant_id).maybeSingle()
    ]);

    if (!candidate || !exam) {
      throw new Error('Candidate or Exam not found');
    }

    const tenantInfo = tenant || { name: 'AssessmentXP' };
    const logoB64 = branding?.logo_base64 || null;
    const badgeB64 = branding?.badge_base64 || null;
    const sigB64 = branding?.signature_base64 || null;
    const bgB64 = branding?.background_base64 || null;
    const hexColor = branding?.border_color || tenantInfo.border_color || '#000000';

    // Initialise PDF
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    // Draw Background
    if (bgB64) {
      doc.addImage(bgB64, 'JPEG', 0, 0, 297, 210, undefined, 'FAST');
    }

    doc.setDrawColor(hexColor);
    doc.setLineWidth(5);
    doc.rect(10, 10, 277, 190);
    doc.setLineWidth(1);
    doc.rect(15, 15, 267, 180);

    // Draw Logo
    if (logoB64) {
      doc.addImage(logoB64, 'PNG', 118.5, 20, 60, 20, undefined, 'FAST');
    }

    // Draw Badge
    if (badgeB64) {
      doc.addImage(badgeB64, 'PNG', 30, 150, 40, 40, undefined, 'FAST');
    }

    // Draw Signature
    if (sigB64) {
      doc.addImage(sigB64, 'PNG', 200, 150, 60, 25, undefined, 'FAST');
    }

    // Text details
    doc.setFontSize(40);
    doc.setFont('helvetica', 'bold');
    doc.text('Certificate of Completion', 148.5, 50, { align: 'center' });

    doc.setFontSize(20);
    doc.setFont('helvetica', 'normal');
    doc.text('This is to certify that', 148.5, 75, { align: 'center' });

    doc.setFontSize(30);
    doc.setFont('helvetica', 'italic');
    const name = candidate.full_name || candidate.email || 'Candidate';
    doc.text(name, 148.5, 95, { align: 'center' });

    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.text('has successfully completed the exam:', 148.5, 115, { align: 'center' });

    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(exam.title || 'Assessment', 148.5, 130, { align: 'center' });

    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.text(`with an Academic Score of ${result.academic_score}%`, 148.5, 145, { align: 'center' });

    doc.setFontSize(14);
    doc.text(`Awarded by: ${tenantInfo.name || 'Organization'}`, 148.5, 170, { align: 'center' });
    doc.text(`Date: ${new Date(result.created_at || Date.now()).toLocaleDateString()}`, 148.5, 180, { align: 'center' });

    // Output arraybuffer
    const pdfArrayBuffer = doc.output('arraybuffer');
    const pdfBuffer = Buffer.from(pdfArrayBuffer);

    // Upload to Supabase Storage
    const path = `certificates/${result.id}.pdf`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('certificates')
      .upload(path, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) throw uploadError;

    // Fetch Public URL
    const { data: urlData } = supabase.storage.from('certificates').getPublicUrl(uploadData.path);
    const certificateUrl = urlData.publicUrl;

    // Update Result row
    const { error: updateError } = await supabase
      .from('results')
      .update({ certificate_url: certificateUrl })
      .eq('id', result.id);

    if (updateError) throw updateError;

    res.json({ success: true, certificate_url: certificateUrl });
  } catch (err) {
    console.error('[generate-certificate] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
