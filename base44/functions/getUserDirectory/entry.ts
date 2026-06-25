import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only platform-level admins may extract the full user directory
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Pull all the data we need using service role (admin privileges)
    const [allUsers, tenantUsers, institutions] = await Promise.all([
      base44.asServiceRole.entities.User.list('-created_date', 1000),
      base44.asServiceRole.entities.TenantUser.list('-created_date', 5000),
      base44.asServiceRole.entities.Institution.list('-created_date', 1000),
    ]);

    const institutionMap = {};
    institutions.forEach((inst) => {
      institutionMap[inst.id] = inst.name;
    });

    // Group tenant assignments by user
    const assignmentsByUser = {};
    tenantUsers.forEach((tu) => {
      if (!assignmentsByUser[tu.user_id]) assignmentsByUser[tu.user_id] = [];
      assignmentsByUser[tu.user_id].push({
        role: tu.role,
        institution_id: tu.institution_id,
        institution_name: institutionMap[tu.institution_id] || 'Unknown',
        is_active: tu.is_active,
      });
    });

    const directory = allUsers.map((u) => {
      const assignments = assignmentsByUser[u.id] || [];

      // Determine the effective persona
      let persona = 'Unassigned';
      if (u.role === 'super_admin') persona = 'Super Admin';
      else if (u.role === 'admin') persona = 'Admin';
      else if (assignments.length > 0) {
        const roles = assignments.map((a) => a.role);
        if (roles.includes('tenant_admin')) persona = 'Tenant Admin';
        else if (roles.includes('tenant_executive')) persona = 'Tenant Executive';
        else if (roles.includes('candidate')) persona = 'Candidate';
      }

      return {
        id: u.id,
        full_name: u.full_name || '—',
        email: u.email,
        global_role: u.role,
        persona,
        institution_name: assignments[0]?.institution_name || '—',
        tenant_roles: assignments.map((a) => a.role),
        created_date: u.created_date,
      };
    });

    // Build summary counts per persona
    const summary = directory.reduce((acc, d) => {
      acc[d.persona] = (acc[d.persona] || 0) + 1;
      return acc;
    }, {});

    return Response.json({ directory, summary, total: directory.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});