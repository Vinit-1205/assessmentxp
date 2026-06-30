const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const authMiddleware = require('../middleware/auth');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configure Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
  port: parseInt(process.env.SMTP_PORT || '2525'),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ────────────────────────────────────────────────────────────
// POST /api/create-exam
// ────────────────────────────────────────────────────────────
router.post('/create-exam', authMiddleware, async (req, res) => {
  const { title, course_id, institution_id, status } = req.body;

  if (req.user.active_role !== 'tenant_admin' && req.user.active_role !== 'super_admin' && req.user.active_role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const { data: exam, error } = await supabase
      .from('exams')
      .insert({
        title: title || 'New Exam',
        course_id: course_id || null,
        institution_id: institution_id || req.user.institution_id,
        status: status || 'draft',
        duration_minutes: 60,
        passing_threshold: 50,
        total_marks: 0,
        shuffle_questions: true,
        shuffle_options: true,
        max_attempts: 1,
        proctoring_strictness: 'Standard'
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ exam });
  } catch (err) {
    console.error('[create-exam] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────
// PUT /api/update-exam/:id
// ────────────────────────────────────────────────────────────
router.put('/update-exam/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  if (req.user.active_role !== 'tenant_admin' && req.user.active_role !== 'super_admin' && req.user.active_role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const { data: exam, error } = await supabase
      .from('exams')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ exam });
  } catch (err) {
    console.error('[update-exam] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────
// POST /api/randomize-exam
// ────────────────────────────────────────────────────────────
router.post('/randomize-exam', async (req, res) => {
  const { questions, shuffle_questions, shuffle_options } = req.body;

  if (!questions || !Array.isArray(questions)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  try {
    let resultQuestions = [...questions];

    // Helper: shuffle array
    const shuffleArray = (array) => {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    };

    // 1. Shuffle questions if requested
    if (shuffle_questions !== false) {
      resultQuestions = shuffleArray(resultQuestions);
    }

    // 2. Shuffle options inside each question if requested
    if (shuffle_options !== false) {
      resultQuestions = resultQuestions.map((q) => {
        if (q.type === 'MCQ' && q.options && Array.isArray(q.options) && q.options.length > 0) {
          const originalOptions = [...q.options];
          const indexedOptions = originalOptions.map((opt, index) => ({ opt, index }));
          const shuffledIndexed = shuffleArray(indexedOptions);
          
          const newOptions = shuffledIndexed.map(item => item.opt);
          // Update correct option index
          let newCorrectIdx = q.correct_option_index;
          if (q.correct_option_index !== null && q.correct_option_index !== undefined) {
            newCorrectIdx = shuffledIndexed.findIndex(item => item.index === q.correct_option_index);
          }

          return {
            ...q,
            options: newOptions,
            correct_option_index: newCorrectIdx === -1 ? q.correct_option_index : newCorrectIdx
          };
        }
        return q;
      });
    }

    res.json({ success: true, questions: resultQuestions });
  } catch (err) {
    console.error('[randomize-exam] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────
// POST /api/deploy-exam
// ────────────────────────────────────────────────────────────
router.post('/deploy-exam', authMiddleware, async (req, res) => {
  const { exam_id, emails } = req.body;

  if (req.user.active_role !== 'tenant_admin' && req.user.active_role !== 'super_admin' && req.user.active_role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!exam_id || !emails || !Array.isArray(emails)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  try {
    const examTokens = [];
    const tenantId = req.user.institution_id;

    for (const email of emails) {
      // Generate a secure random 12-char alphanumeric token
      const token = crypto.randomBytes(9)
        .toString('base64')
        .replace(/[^a-zA-Z0-9]/g, '')
        .substring(0, 12)
        .toUpperCase();

      examTokens.push({
        tenant_id: tenantId,
        exam_id: exam_id,
        candidate_email: email.trim().toLowerCase(),
        token: token,
        status: 'active'
      });
    }

    // Bulk insert exam tokens bypassing RLS
    if (examTokens.length > 0) {
      const { error: insertError } = await supabase
        .from('exam_tokens')
        .insert(examTokens);

      if (insertError) throw insertError;
    }

    // Send Emails
    for (const record of examTokens) {
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@assessmentxp.com',
        to: record.candidate_email,
        subject: 'Your Exam Token & Login Link',
        text: `You have been enrolled in an exam.\n\nYour secure Exam Token is: ${record.token}\n\nPlease login and use this token to start the exam.`,
      };

      try {
        if (process.env.SMTP_USER && process.env.SMTP_PASS) {
          await transporter.sendMail(mailOptions);
        } else {
          // Log to console for testing/development if credentials are not filled
          if (process.env.NODE_ENV === 'production') {
            console.log('[SIMULATE EMAIL] Email simulate triggered (sensitive details masked in production).');
          } else {
            console.log(`[SIMULATE EMAIL] Sent to: ${record.candidate_email} | Subject: ${mailOptions.subject} | Token: ${record.token}`);
          }
        }
      } catch (mailErr) {
        if (process.env.NODE_ENV === 'production') {
          console.error('[deploy-exam] Failed to send email to a candidate.');
        } else {
          console.error(`Failed to send email to ${record.candidate_email}:`, mailErr.message);
        }
      }
    }

    res.json({ success: true, count: examTokens.length });
  } catch (err) {
    console.error('[deploy-exam] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
