import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const payload = await req.json();
    
    // We only care about tenant users. The automation passes { event, data, old_data }
    const user_id = payload.data?.user_id || payload.old_data?.user_id;
    if (!user_id) return Response.json({ success: true });

    // Fetch all active TenantUser records for this user
    const tenantUsers = await sr.entities.TenantUser.filter({ user_id: user_id, is_active: true });

    const tenant_access = tenantUsers.map(tu => ({
      institution_id: tu.institution_id,
      role: tu.role
    }));

    // Update the base user with the newly computed access rights
    await sr.entities.User.update(user_id, { tenant_access });

    return Response.json({ success: true, user_id, tenant_access });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});