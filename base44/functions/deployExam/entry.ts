import { createClientFromRequest } from 'npm:@base44/sdk@0.8.28';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'tenant_admin') {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }

        const payload = await req.json();
        const { exam_id, emails } = payload;

        if (!exam_id || !emails || !Array.isArray(emails)) {
            return Response.json({ error: 'Invalid payload' }, { status: 400 });
        }

        const examTokens = [];
        for (const email of emails) {
            // Generate a random 12-char secure token
            const tokenBytes = new Uint8Array(9);
            crypto.getRandomValues(tokenBytes);
            const token = Array.from(tokenBytes)
                .map(b => b.toString(36).padStart(2, '0'))
                .join('').substring(0, 12).toUpperCase();
            
            examTokens.push({
                tenant_id: user.tenant_id,
                exam_id: exam_id,
                candidate_email: email,
                token: token,
                status: 'active'
            });
        }

        // Bulk create tokens
        if (examTokens.length > 0) {
            await base44.asServiceRole.entities.ExamToken.bulkCreate(examTokens);
        }

        // Simulate sending emails
        for (const record of examTokens) {
             await base44.asServiceRole.integrations.Core.SendEmail({
                 to: record.candidate_email,
                 subject: "Your Exam Token & Login Link",
                 body: `You have been enrolled in an exam.\n\nYour secure Exam Token is: ${record.token}\n\nPlease login and use this token to start the exam.`
             });
        }

        return Response.json({ success: true, count: examTokens.length });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});