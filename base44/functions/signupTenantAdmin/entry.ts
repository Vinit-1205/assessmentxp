import { createClientFromRequest } from 'npm:@base44/sdk@0.8.32';

// Normalize a domain/website: trim, lowercase, strip protocol, strip trailing slash, strip "www."
function normalizeDomain(value) {
    if (!value) return null;
    let v = String(value).trim().toLowerCase();
    v = v.replace(/^https?:\/\//i, '');
    v = v.replace(/^www\./i, '');
    v = v.replace(/\/+$/, '');
    return v || null;
}

function normalizeSlug(value) {
    if (!value) return null;
    return String(value).trim().toLowerCase().replace(/\s+/g, '-');
}

function serializeError(error) {
    const out = {
        message: error?.message ?? null,
        name: error?.name ?? null,
        status: error?.status ?? error?.response?.status ?? null,
        responseData: null,
        stack: error?.stack ?? null,
        raw: null
    };
    try {
        out.responseData = error?.response?.data ?? error?.data ?? null;
    } catch (_) { /* ignore */ }
    try {
        out.raw = JSON.stringify(error, Object.getOwnPropertyNames(error || {}));
    } catch {
        try { out.raw = String(error); } catch { out.raw = 'unserializable error'; }
    }
    return out;
}

Deno.serve(async (req) => {
    console.log("=== FUNCTION ENTRY: signupTenantAdmin ===");
    try {
        const base44 = createClientFromRequest(req);

        console.log("STEP 1 - Validate Input");
        let data;
        try {
            data = await req.json();
            console.log("Request Body:", JSON.stringify(data, null, 2));
        } catch (e) {
            console.error("Failed to parse request body", e.stack);
            return Response.json({ success: false, step: "parse_body", error: "Invalid JSON body", stack: e.stack }, { status: 400 });
        }

        console.log("STEP 2 - Load User (Bypassable)");
        let user = null;
        try {
            user = await base44.auth.me();
            console.log("Current Authenticated User:", JSON.stringify(user, null, 2));
        } catch (e) {
            console.warn("Failed to load authenticated user. Proceeding for testing.", e.message);
        }

        let resolvedEmail = user?.email ? String(user.email).trim() : null;
        if (!resolvedEmail && data?.email) {
            resolvedEmail = String(data.email).trim();
        }
        
        const userId = user?.id || null;

        if (!resolvedEmail) {
            return Response.json({ success: false, step: "validate_user", error: "Could not resolve user email" }, { status: 400 });
        }

        const name = data.name ? String(data.name).trim() : null;
        const slug = normalizeSlug(data.slug);
        const domain = normalizeDomain(data.domain);
        const website = normalizeDomain(data.website);
        const country = data.country ? String(data.country).trim() : null;
        const phone = data.phone ? String(data.phone).trim() : null;
        let address = data.address ? String(data.address).trim() : null;
        const location = data.location ? String(data.location).trim() : null;
        const student_volume = data.student_volume != null && data.student_volume !== '' ? String(data.student_volume) : null;
        const logo_url = data.logo_url ? String(data.logo_url).trim() : null;

        if (!name || !slug || !country || !phone) {
            return Response.json({
                success: false,
                step: "validate_input",
                error: "Missing required fields",
                missing: { name: !name, slug: !slug, country: !country, phone: !phone }
            }, { status: 400 });
        }

        // Duplicate Check
        try {
            const allInstitutions = await base44.asServiceRole.entities.Institution.list();
            const existingInstitutions = allInstitutions.filter(i => {
                const iSlug = i.slug ? String(i.slug).trim().toLowerCase() : null;
                const iDomain = i.domain ? normalizeDomain(i.domain) : null;
                return (iSlug && iSlug === slug) || (domain && iDomain && iDomain === domain);
            });

            if (existingInstitutions.length > 0) {
                const ownByUser = existingInstitutions.find(i => userId && i.created_by_id === userId);
                if (!ownByUser) {
                    return Response.json({ success: false, step: "duplicate_check", error: "An institution with this slug or domain already exists." }, { status: 400 });
                }
            }
        } catch (e) {
            console.error("Duplicate check failed", e.stack);
            return Response.json({ success: false, step: "duplicate_check", error: e.message, stack: e.stack }, { status: 500 });
        }

        console.log("STEP 3 - Create Institution");
        const institutionPayload = {
            name, slug, domain, website, country, phone,
            address, location, student_volume, logo_url, 
            status: 'Pending',
            is_active: true
        };
        console.log("Institution Payload:", JSON.stringify(institutionPayload, null, 2));

        let institution;
        try {
            institution = await base44.asServiceRole.entities.Institution.create(institutionPayload);
            console.log("Institution Created Successfully:", JSON.stringify(institution, null, 2));
        } catch (e) {
            const errInfo = serializeError(e);
            console.error("Institution Creation Failed", e.stack);
            console.error("Full Error Details:", JSON.stringify(errInfo, null, 2));
            return Response.json({
                success: false,
                step: "institution_creation",
                error: e.message,
                stack: e.stack,
                details: errInfo.responseData
            }, { status: 500 });
        }

        if (!institution || !institution.id) {
            return Response.json({ success: false, step: "institution_creation", error: "Institution was created but no ID was returned" }, { status: 500 });
        }

        console.log("STEP 4 - Create TenantUser");
        const tenantUserPayload = {
            user_id: userId,
            email: resolvedEmail,
            institution_id: institution.id,
            role: 'tenant_admin',
            is_active: false
        };
        console.log("TenantUser Payload:", JSON.stringify(tenantUserPayload, null, 2));

        let tenantUser;
        try {
            tenantUser = await base44.asServiceRole.entities.TenantUser.create(tenantUserPayload);
            console.log("TenantUser Created Successfully:", JSON.stringify(tenantUser, null, 2));
        } catch (e) {
            const errInfo = serializeError(e);
            console.error("TenantUser Creation Failed", e.stack);
            console.error("Full Error Details:", JSON.stringify(errInfo, null, 2));

            // Rollback
            console.log("Rolling back Institution creation...");
            try {
                await base44.asServiceRole.entities.Institution.delete(institution.id);
                console.log("Rollback successful.");
            } catch (rollbackError) {
                console.error("Rollback failed", rollbackError.stack);
            }

            return Response.json({
                success: false,
                step: "tenant_user_creation",
                error: e.message,
                stack: e.stack,
                details: errInfo.responseData
            }, { status: 500 });
        }

        console.log("STEP 5 - Complete Setup");
        console.log("Setup completed successfully for user:", resolvedEmail);
        return Response.json({
            success: true,
            institution_id: institution.id,
            tenant_user_id: tenantUser.id
        });

    } catch (error) {
        console.error("=== UNHANDLED ERROR IN SIGNUP TENANT ADMIN ===", error.stack);
        return Response.json({
            success: false,
            step: "unhandled_error",
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});