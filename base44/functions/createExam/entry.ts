import { createClientFromRequest } from 'npm:@base44/sdk@0.8.32';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const currentUser = await base44.auth.me();
        console.log("=== CREATE EXAM FUNCTION EXECUTED ===");

        if (!currentUser) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = await req.json();
        const { institution_id, questions, ...examData } = payload;
        
        console.log("=== EXAM CREATION DEBUG ===");
        console.log("User ID:", currentUser?.id);
        console.log("User Email:", currentUser?.email);
        console.log("User Role:", currentUser?.role);
        
        const tenantAccess = await base44.asServiceRole.entities.TenantUser.filter({ user_id: currentUser.id });
        
        console.log("Current User", currentUser);
        console.log("Tenant Access From User", currentUser?.data?.tenant_access);
        console.log("TenantUser Records", tenantAccess);
        console.log("Institution ID", institution_id);
        
        let hasAccess = false;
        if (currentUser.role === 'admin' || currentUser.role === 'super_admin') {
            hasAccess = true;
        } else {
            let validTenant = tenantAccess.find(t => 
                String(t.institution_id) === String(institution_id) && 
                ['tenant_admin', 'tenant_executive'].includes(t.role)
            );
            
            // Fallback to user.data.tenant_access to fix source-of-truth mismatch
            if (!validTenant && currentUser?.data?.tenant_access) {
                validTenant = currentUser.data.tenant_access.find(t => 
                    String(t.institution_id) === String(institution_id) && 
                    ['tenant_admin', 'tenant_executive'].includes(t.role)
                );
            }

            if (validTenant) {
                hasAccess = true;
            }
        }
        
        if (!hasAccess) {
            return Response.json({ error: 'Forbidden: Missing tenant_admin access for this institution' }, { status: 403 });
        }
        
        const createdExam = await base44.asServiceRole.entities.Exam.create({
            ...examData,
            institution_id
        });
        
        if (questions && questions.length > 0) {
            const newQuestions = questions.map(q => ({
                ...q,
                exam_id: createdExam.id,
                institution_id
            }));
            await base44.asServiceRole.entities.Question.bulkCreate(newQuestions);
        }
        
        console.log("=== EXAM CREATED SUCCESSFULLY ===");
        console.log(JSON.stringify(createdExam, null, 2));

        return Response.json({ exam: createdExam });
    } catch (error) {
        console.error("=== EXAM CREATE ERROR ===");
        console.error(error);
        console.error(error?.message);
        console.error(error?.stack);
        return Response.json({ error: error.message }, { status: 500 });
    }
});