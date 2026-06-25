import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Admin-only repair utility:
// For every tenant_admin / tenant_executive user whose tenant_id points to a non-existent
// Tenant record, create a fresh Tenant and re-link the user to it.
// This fixes the root cause where users were assigned orphan tenant_ids during signup,
// blocking all RLS-protected creates (Exam, BankQuestion, Question, etc).
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const caller = await base44.auth.me();

        if (!caller || (caller.role !== 'admin' && caller.role !== 'super_admin')) {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const allUsers = await base44.asServiceRole.entities.User.list();
        const tenantUsers = allUsers.filter(u =>
            u.role === 'tenant_admin' || u.role === 'tenant_executive'
        );

        const repaired = [];
        const skipped = [];

        for (const u of tenantUsers) {
            const tenantId = u.tenant_id;
            if (!tenantId) {
                skipped.push({ email: u.email, reason: 'no tenant_id' });
                continue;
            }

            // Check if the linked tenant actually exists
            let existing = null;
            try {
                existing = await base44.asServiceRole.entities.Tenant.get(tenantId);
            } catch (_e) {
                existing = null;
            }

            if (existing) {
                skipped.push({ email: u.email, reason: 'tenant already exists', tenantId });
                continue;
            }

            // Tenant is missing — create a fresh one and re-link the user
            const newTenant = await base44.asServiceRole.entities.Tenant.create({
                name: `${u.full_name || u.email.split('@')[0]}'s Organization`,
                status: 'active',
                primary_color: '#002147',
                border_color: '#000000'
            });

            await base44.asServiceRole.entities.User.update(u.id, {
                tenant_id: newTenant.id
            });

            repaired.push({
                email: u.email,
                oldTenantId: tenantId,
                newTenantId: newTenant.id,
                newTenantName: newTenant.name
            });
        }

        return Response.json({
            success: true,
            repaired_count: repaired.length,
            skipped_count: skipped.length,
            repaired,
            skipped
        });
    } catch (error) {
        return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
});