import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Find the Tenant, create if it doesn't exist to ensure the demo works
        let tenants = await base44.asServiceRole.entities.Tenant.filter({ name: 'Digital Strategy Institute' });
        if (tenants.length === 0) {
            const newTenant = await base44.asServiceRole.entities.Tenant.create({
                name: 'Digital Strategy Institute',
                status: 'active'
            });
            tenants = [newTenant];
        }
        const tenantId = tenants[0].id;

        // Find the User, create or update
        let users = await base44.asServiceRole.entities.User.filter({ email: 'drcheryltann@gmail.com' });
        let userId;
        
        // As we can't create users directly via entities API (platform rule), 
        // we assume the user must exist if they tried to log in, otherwise we return an error
        if (users.length === 0) {
            return Response.json({ error: 'User "drcheryltann@gmail.com" not found in the system yet. Please have them register or log in first.' }, { status: 404 });
        } else {
            userId = users[0].id;
            await base44.asServiceRole.entities.User.update(userId, { tenant_id: tenantId, role: 'tenant_admin' });
        }

        return Response.json({ 
            success: true, 
            message: `User ${users[0].email} successfully linked to Tenant ${tenants[0].name}`,
            tenantId,
            userId
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});