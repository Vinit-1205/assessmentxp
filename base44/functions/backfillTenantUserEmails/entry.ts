import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const caller = await base44.auth.me();

        if (caller?.role !== 'admin' && caller?.role !== 'super_admin') {
            return Response.json({ error: 'Forbidden: Admin access required', callerRole: caller?.role }, { status: 403 });
        }

        // Build a lookup map of user_id -> email
        const users = await base44.asServiceRole.entities.User.list('-created_date', 1000);
        const emailById = {};
        for (const u of users) {
            emailById[u.id] = u.email;
        }

        // Backfill TenantUser records missing an email.
        // The TenantUser RLS update rule only allows users whose user_condition.role
        // is super_admin/admin, or tenant_admin within the institution. To satisfy
        // this from the service role, we recreate the record with the email field
        // (create has no RLS restriction in the existing flows).
        const tenantUsers = await base44.asServiceRole.entities.TenantUser.list('-created_date', 1000);
        let updated = 0;
        let skipped = 0;
        const errors = [];

        for (const tu of tenantUsers) {
            if (tu.email) {
                skipped++;
                continue;
            }
            const email = emailById[tu.user_id];
            if (!email) {
                skipped++;
                continue;
            }
            try {
                await base44.asServiceRole.entities.TenantUser.update(tu.id, { email });
                updated++;
            } catch (e) {
                errors.push({ id: tu.id, error: e.message });
            }
        }

        return Response.json({ success: true, updated, skipped, total: tenantUsers.length, errors });
    } catch (error) {
        return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
});
