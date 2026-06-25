import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Diagnostic + repair: uses service role to bypass ALL RLS.
// 1. Lists all tenants visible at service-role level.
// 2. For each tenant_admin user, checks if their tenant_id resolves to a real Tenant.
// 3. If not, creates one with the user's tenant_id reused as the name basis, and re-links.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sr = base44.asServiceRole;

    const allTenants = await sr.entities.Tenant.list();
    const allUsers = await sr.entities.User.list();
    const tenantUsers = allUsers.filter(
      (u) => u.role === 'tenant_admin' || u.role === 'tenant_executive'
    );

    const actions = [];

    for (const u of tenantUsers) {
      const linkedTenant = u.tenant_id
        ? allTenants.find((t) => t.id === u.tenant_id)
        : null;

      if (linkedTenant) {
        actions.push({ email: u.email, status: 'ok', tenant: linkedTenant.name });
        continue;
      }

      // Create a real tenant and re-link
      const created = await sr.entities.Tenant.create({
        name: `${u.full_name || u.email.split('@')[0]}'s Organization`,
        status: 'active',
        primary_color: '#002147',
        border_color: '#000000',
      });

      await sr.entities.User.update(u.id, { tenant_id: created.id });

      actions.push({
        email: u.email,
        status: 'repaired',
        old_tenant_id: u.tenant_id,
        new_tenant_id: created.id,
      });
    }

    // Re-read after repair
    const tenantsAfter = await sr.entities.Tenant.list();

    return Response.json({
      success: true,
      tenants_before: allTenants.length,
      tenants_after: tenantsAfter.length,
      tenants_list: tenantsAfter.map((t) => ({ id: t.id, name: t.name })),
      actions,
    });
  } catch (error) {
    return Response.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
});