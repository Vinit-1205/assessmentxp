import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Parse request payload
    const payload = await req.json();
    const { credential_id } = payload;

    if (!credential_id) {
      return Response.json({ valid: false, error: 'Credential ID is required' }, { status: 400 });
    }

    // Fetch result bypassing RLS (public verification using Service Role)
    const result = await base44.asServiceRole.entities.Result.get(credential_id);
    
    if (!result) {
      return Response.json({ valid: false, error: 'Invalid or missing credential' });
    }

    // Fetch associated Exam and User data securely
    const exam = await base44.asServiceRole.entities.Exam.get(result.exam_id);
    const candidate = await base44.asServiceRole.entities.User.get(result.candidate_id);

    return Response.json({
      valid: true,
      credential: {
        id: result.id,
        candidate_name: candidate.full_name,
        exam_title: exam.title,
        score: result.academic_score,
        status: result.final_result_status,
        issue_date: result.created_date,
        certificate_url: result.certificate_url
      }
    });
  } catch (error) {
    return Response.json({ valid: false, error: 'Credential not found or invalid' });
  }
});