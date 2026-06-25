import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Probe: write a single Tenant, immediately read it back by ID, then list all.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;

    const beforeList = await sr.entities.Tenant.list();
    
    const created = await sr.entities.Tenant.create({
      name: 'PROBE_TENANT_' + Date.now(),
      status: 'active',
    });

    let fetched = null;
    let fetchError = null;
    try {
      fetched = await sr.entities.Tenant.get(created.id);
    } catch (e) {
      fetchError = e.message;
    }

    const afterList = await sr.entities.Tenant.list();
    const filterResult = await sr.entities.Tenant.filter({ id: created.id });

    return Response.json({
      created,
      fetched,
      fetchError,
      before_count: beforeList.length,
      after_count: afterList.length,
      after_list: afterList,
      filter_by_id_result: filterResult,
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});