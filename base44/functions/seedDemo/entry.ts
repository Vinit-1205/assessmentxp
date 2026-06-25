import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // 1. Create Tenant
        const tenant = await base44.asServiceRole.entities.Tenant.create({
            id: 'demo-tenant-99',
            name: 'Demo Academy',
            border_color: '#002147',
            status: 'active'
        });

        // 2. Create Exam
        const exam = await base44.asServiceRole.entities.Exam.create({
            tenant_id: 'demo-tenant-99',
            title: 'Cybersecurity Foundations',
            description: 'A comprehensive evaluation of foundational cybersecurity concepts.',
            duration_minutes: 60,
            passing_threshold: 60,
            total_marks: 45,
            shuffle_questions: true,
            shuffle_options: true,
            status: 'published'
        });

        return Response.json({ success: true, tenant, exam });
    } catch (error) {
        return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
});