import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (user?.role !== 'super_admin' && user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const { name, domain, adminEmail } = await req.json();

        // Step A: Create Organization
        const newTenant = await base44.asServiceRole.entities.Tenant.create({
            name,
            domain,
            status: 'active'
        });

        // Step B: User invitation is now handled securely by the unified inviteUser endpoint triggered from the frontend.

        return Response.json({ tenant: newTenant });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});