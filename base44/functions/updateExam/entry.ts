import { createClientFromRequest } from 'npm:@base44/sdk@0.8.32';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const currentUser = await base44.auth.me();

        if (!currentUser) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = await req.json();
        const { exam_id, institution_id, questions_to_add, questions_to_delete, ...examData } = payload;
        
        const tenantAccess = await base44.asServiceRole.entities.TenantUser.filter({ user_id: currentUser.id });
        
        let hasAccess = false;
        if (currentUser.role === 'admin' || currentUser.role === 'super_admin') {
            hasAccess = true;
        } else {
            const validTenant = tenantAccess.find(t => 
                String(t.institution_id) === String(institution_id) && 
                ['tenant_admin', 'tenant_executive'].includes(t.role)
            );
            if (validTenant) {
                hasAccess = true;
            }
        }
        
        if (!hasAccess) {
            return Response.json({ error: 'Forbidden: Missing access for this institution' }, { status: 403 });
        }
        
        const updatedExam = await base44.asServiceRole.entities.Exam.update(exam_id, examData);
        
        if (questions_to_delete && questions_to_delete.length > 0) {
            await Promise.all(questions_to_delete.map(qId => 
                base44.asServiceRole.entities.Question.delete(qId)
            ));
        }

        if (questions_to_add && questions_to_add.length > 0) {
            const newQuestions = questions_to_add.map(q => ({
                ...q,
                exam_id,
                institution_id
            }));
            await base44.asServiceRole.entities.Question.bulkCreate(newQuestions);
        }

        return Response.json({ exam: updatedExam });
    } catch (error) {
        console.error("=== EXAM UPDATE ERROR ===");
        console.error(error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});