const express = require('express');
const router = express.Router();
const supabase = require('../db/postgresShim');
const authMiddleware = require('../middleware/auth');

// ────────────────────────────────────────────────────────────
// POST /api/violations
// Service-role creation of violations (bypasses candidate RLS).
// Accepts an optional `image_base64` field (data URL or raw base64)
// which is uploaded to Supabase Storage and the resulting public URL
// is stored as media_url.
// ────────────────────────────────────────────────────────────
router.post('/violations', authMiddleware, async (req, res) => {
  const {
    tenant_id,
    exam_id,
    candidate_id,
    attempt_id,
    type,
    timestamp,
    media_url,
    image_base64  // Optional: raw webcam snapshot sent from the frontend
  } = req.body;

  if (!exam_id || !attempt_id || !type) {
    return res.status(400).json({ error: 'Missing required parameters (exam_id, attempt_id, type)' });
  }

  try {
    let finalMediaUrl = media_url || null;

    let uploadDebugMsg = '';
    // ── Upload webcam snapshot if provided ──────────────────
    if (image_base64) {
      try {
        // Strip the data URL prefix if present: "data:image/jpeg;base64,..."
        const base64Data = image_base64.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        const institutionId = tenant_id || req.user?.institution_id || 'unknown';
        const candidateIdStr = candidate_id || req.user?.id || 'unknown';
        const ts = Date.now();
        const storagePath = `violations/${institutionId}/${candidateIdStr}/${attempt_id}_${ts}.jpg`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('certificates')
          .upload(storagePath, imageBuffer, {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (uploadError) {
          console.error('[violations] Storage upload failed:', uploadError.message);
          uploadDebugMsg = ` (Backend storage error: ${uploadError.message})`;
        } else {
          const { data: urlData } = supabase.storage
            .from('certificates')
            .getPublicUrl(uploadData.path);
          finalMediaUrl = urlData.publicUrl;
          console.log('[violations] Snapshot uploaded:', finalMediaUrl);
        }
      } catch (imgErr) {
        console.error('[violations] Image processing error:', imgErr.message);
        uploadDebugMsg = ` (Backend image processing error: ${imgErr.message})`;
      }
    }

    // ── Insert violation record ────────────────────────────
    const { data: violation, error } = await supabase
      .from('violations')
      .insert({
        institution_id: tenant_id || req.user?.institution_id,
        exam_id,
        candidate_id: candidate_id || req.user?.id,
        attempt_id,
        type: type + uploadDebugMsg,
        timestamp: timestamp || new Date().toISOString(),
        media_url: finalMediaUrl
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, violation, media_url: finalMediaUrl });
  } catch (err) {
    console.error('[violations] insert error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
