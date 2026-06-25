import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'super_admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const tenants = await base44.asServiceRole.entities.Tenant.list();
    const results = await base44.asServiceRole.entities.Result.list();
    const exams = await base44.asServiceRole.entities.Exam.list();
    const violations = await base44.asServiceRole.entities.Violation.list();
    const users = await base44.asServiceRole.entities.User.list();

    const metrics = tenants.map(tenant => {
      const tenantResults = results.filter(r => r.tenant_id === tenant.id);
      
      let proctoredMinutes = 0;
      tenantResults.forEach(r => {
        const exam = exams.find(e => e.id === r.exam_id);
        if (exam) {
          proctoredMinutes += (exam.duration_minutes || 60);
        }
      });
      
      // Estimate 5.2 MB per violation media for storage
      const tenantViolations = violations.filter(v => v.tenant_id === tenant.id && v.media_url);
      const storageMB = tenantViolations.length * 5.2; 

      const activeCandidates = users.filter(u => u.tenant_id === tenant.id && u.role === 'candidate').length;

      return {
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        total_exams: tenantResults.length,
        proctored_hours: +(proctoredMinutes / 60).toFixed(1),
        storage_used_mb: +storageMB.toFixed(1),
        active_candidates: activeCandidates
      };
    });

    return Response.json({ metrics });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});