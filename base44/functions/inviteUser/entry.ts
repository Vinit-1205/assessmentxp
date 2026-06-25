import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const inviter = await base44.auth.me();

        console.log("=== FULL AUTH.ME() RESPONSE ===");
        console.log(JSON.stringify(inviter, null, 2));

        console.log("=== AUTH DETAILS ===");
        console.log("ID:", inviter?.id);
        console.log("EMAIL:", inviter?.email);
        console.log("ROLE:", inviter?.role);
        console.log("TENANT ACCESS:", inviter?.tenant_access);
        console.log("TENANT ACCESS TYPE:", typeof inviter?.tenant_access);
        console.log("TENANT ACCESS LENGTH:", inviter?.tenant_access?.length);

        if (!inviter) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { email, role, institution_id, full_name } = await req.json();

        if (!email || !role) {
            return Response.json({ error: 'Email and role are required' }, { status: 400 });
        }

        let targetInstitutionId = institution_id;
        let targetRole = role;
        let isFaculty = false;

        // Look up the inviter's TenantUser records directly from the entity (source of truth)
        console.log("=== LOOKING UP TENANT ACCESS FROM TenantUser ENTITY ===");
        console.log("Inviter ID:", inviter.id);
        console.log("Inviter Email:", inviter.email);

        const inviterTenantRecords = await base44.asServiceRole.entities.TenantUser.filter({ user_id: inviter.id });
        console.log("TenantUser records found:", JSON.stringify(inviterTenantRecords, null, 2));

        if (role !== 'candidate') {
            isFaculty = true;
            console.log("=== ADD FACULTY ===");

            const validTenantAccess = inviterTenantRecords.find(t => t.role === "tenant_admin");
            console.log("Valid tenant_admin record:", JSON.stringify(validTenantAccess, null, 2));

            if (!validTenantAccess) {
                return Response.json({ 
                    error: "Forbidden - Inviter does not have tenant_admin role in TenantUser entity",
                    inviter_id: inviter.id,
                    inviter_email: inviter.email,
                    tenant_records_found: inviterTenantRecords.length
                }, { status: 403 });
            }

            targetInstitutionId = validTenantAccess.institution_id;
            targetRole = "tenant_executive";

            console.log("Derived Institution ID:", targetInstitutionId);
            console.log("Faculty Email:", email);
            console.log("Assigned Role:", "tenant_executive");
        } else {
            if (!targetInstitutionId) {
                return Response.json({ error: 'institution_id is required' }, { status: 400 });
            }
            
            let hasAccess = false;
            if (inviter.role === "admin" || inviter.role === "super_admin") {
                hasAccess = true;
            } else {
                const hasValidAccess = inviterTenantRecords.some(
                    t => String(t.institution_id) === String(targetInstitutionId) && 
                         ["super_admin", "admin", "tenant_admin"].includes(t.role)
                );
                if (hasValidAccess) hasAccess = true;
            }

            if (!hasAccess) {
                return Response.json({ error: "Forbidden", inviterId: inviter.id, inviterRole: inviter.role }, { status: 403 });
            }
        }

        console.log("Sending invitation...");
        // Step 1: Create the user via platform invite
        await base44.users.inviteUser(email, "user");
        console.log("Invitation sent successfully");

        // Step 2: Wait for user record to materialize
        await new Promise(r => setTimeout(r, 1500));

        console.log("Looking for existing User record...");
        const users = await base44.asServiceRole.entities.User.filter({ email });
        console.log("User lookup result:", users);
        
        let userId = null;
        if (users && users.length > 0) {
            userId = users[0].id;
            if (full_name) {
                await base44.asServiceRole.entities.User.update(userId, { full_name });
            }
        }

        console.log("Creating TenantUser record...");
        // Step 3: Apply TenantUser assignment
        const tenantUserQuery = { institution_id: targetInstitutionId, email: email };
        const existingTenantUser = await base44.asServiceRole.entities.TenantUser.filter(tenantUserQuery);
        
        if (existingTenantUser.length === 0) {
            const newTenantUser = {
                email: email,
                institution_id: targetInstitutionId,
                role: targetRole,
                is_active: true
            };
            if (userId) newTenantUser.user_id = userId;
            
            await base44.asServiceRole.entities.TenantUser.create(newTenantUser);
        }
        console.log("TenantUser created successfully");

        // Step 4: Create Student record if candidate
        if (targetRole === 'candidate') {
            const studentQuery = { institution_id: targetInstitutionId };
            if (userId) studentQuery.user_id = userId;
            else studentQuery.student_identifier = email.split('@')[0];
            
            const existing = await base44.asServiceRole.entities.Student.filter(studentQuery);
            if (existing.length === 0) {
                const newStudent = {
                    institution_id: targetInstitutionId,
                    student_identifier: email.split('@')[0],
                    status: 'active'
                };
                if (userId) newStudent.user_id = userId;
                
                await base44.asServiceRole.entities.Student.create(newStudent);
            }
        }

        // Step 5: Trigger a password-reset email
        await base44.auth.resetPasswordRequest(email);

        if (isFaculty) {
            return Response.json({
                success: true,
                faculty_name: full_name,
                faculty_email: email,
                role: "tenant_executive",
                institution_id: targetInstitutionId
            });
        }

        return Response.json({
            success: true,
            faculty_name: full_name,
            faculty_email: email,
            faculty_role: targetRole,
            institution_id: targetInstitutionId,
            message: "Invitation sent successfully"
        });
    } catch (error) {
        console.error('Error inviting user:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});