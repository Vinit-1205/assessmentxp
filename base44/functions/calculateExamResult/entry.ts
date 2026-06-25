import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const payload = await req.json();
        const { event, data: attempt } = payload;
        
        if (!attempt || event.type !== 'update' || !attempt.completed) {
             return Response.json({ status: 'ignored' });
        }

        const examId = attempt.exam_id;
        const candidateId = attempt.candidate_id;
        const tenantId = attempt.tenant_id;

        // Fetch Exam for passing threshold
        const exam = await base44.asServiceRole.entities.Exam.get(examId);
        const passingThreshold = exam.passing_threshold || 50;

        // Calculate Academic Score
        const rq = attempt.randomized_questions || [];
        let score = 0;
        let totalPossibleScore = 0;
        const answers = attempt.answers || {};
        
        rq.forEach(q => {
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
        const violations = await base44.asServiceRole.entities.Violation.filter({ attempt_id: attempt.id });
        
        violations.forEach(v => {
            if (v.type && v.type.includes('Focus Loss')) {
                integrityScore -= 5;
            } else if (v.type && v.type.includes('Critical Violation')) {
                integrityScore -= 35;
            }
        });

        if (integrityScore < 0) integrityScore = 0;

        // Determine Final Result Status
        let finalResultStatus = 'Failed';
        if (integrityScore < 70) {
            finalResultStatus = 'Pending Admin Review';
        } else if (meetsThreshold && integrityScore >= 70) {
            finalResultStatus = 'Auto-Approved Pass';
        }

        // Create Result
        await base44.asServiceRole.entities.Result.create({
            tenant_id: tenantId,
            exam_id: examId,
            candidate_id: candidateId,
            score: score,
            total_possible_score: totalPossibleScore,
            passed: meetsThreshold,
            academic_score: academicScore,
            integrity_score: integrityScore,
            final_result_status: finalResultStatus
        });

        return Response.json({ success: true, academicScore, integrityScore, finalResultStatus });
    } catch (error) {
        console.error(error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});