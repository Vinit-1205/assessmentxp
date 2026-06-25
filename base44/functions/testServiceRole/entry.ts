import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const institution = await base44.asServiceRole.entities.Institution.create({
            name: "Test",
            slug: "test-" + Date.now(),
            domain: "test.com",
            country: "US",
            address: "123",
            location: "City",
            phone: "123"
        });
        return Response.json({ success: true, id: institution.id });
    } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
    }
});