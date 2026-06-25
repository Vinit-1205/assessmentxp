import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        await base44.asServiceRole.entities.Tenant.create({
            id: 'demo-tenant-99',
            name: 'Demo Academy',
            border_color: '#002147',
            status: 'active'
        });

        await base44.asServiceRole.entities.Exam.create({
            tenant_id: 'demo-tenant-99',
            title: 'Cybersecurity Foundations',
            duration_minutes: 60,
            passing_threshold: 60,
            total_marks: 45,
            status: 'published'
        });

        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});