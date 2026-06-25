import { createClientFromRequest } from 'npm:@base44/sdk@0.8.28';
import { jsPDF } from 'npm:jspdf@4.2.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // This is a webhook-like call from the automation engine, no user auth is present.
        // We must use base44.asServiceRole to query the database.
        
        const payload = await req.json();
        const { event, data } = payload;
        
        if (!data || data.final_result_status !== 'Auto-Approved Pass') {
            return Response.json({ success: true, message: 'Not an approved pass. Skipping.' });
        }
        
        if (data.certificate_url) {
            return Response.json({ success: true, message: 'Certificate already generated.' });
        }
        
        // Fetch candidate, exam, tenant details
        const candidate = await base44.asServiceRole.entities.User.get(data.candidate_id);
        const exam = await base44.asServiceRole.entities.Exam.get(data.exam_id);
        const tenant = await base44.asServiceRole.entities.Tenant.get(data.tenant_id);
        
        // Fetch images as base64 for jsPDF
        const fetchImageAsBase64 = async (url) => {
            if (!url) return null;
            try {
                const res = await fetch(url);
                const buffer = await res.arrayBuffer();
                const base64 = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
                const mime = res.headers.get('content-type') || 'image/png';
                return `data:${mime};base64,${base64}`;
            } catch (e) {
                console.error("Failed to fetch image", url, e);
                return null;
            }
        };

        const [logoB64, badgeB64, sigB64, bgB64] = await Promise.all([
            fetchImageAsBase64(tenant.logo_url),
            fetchImageAsBase64(tenant.badge_url),
            fetchImageAsBase64(tenant.signature_url),
            fetchImageAsBase64(tenant.background_url)
        ]);

        // Generate PDF using jsPDF
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });
        
        // Draw Background
        if (bgB64) {
            doc.addImage(bgB64, 'JPEG', 0, 0, 297, 210, undefined, 'FAST');
        }

        // Draw border
        const hexColor = tenant.border_color || '#000000';
        doc.setDrawColor(hexColor);
        doc.setLineWidth(5);
        doc.rect(10, 10, 277, 190);
        doc.setLineWidth(1);
        doc.rect(15, 15, 267, 180);
        
        // Draw Logo
        if (logoB64) {
            // center top
            doc.addImage(logoB64, 'PNG', 118.5, 20, 60, 20, undefined, 'FAST');
        }

        // Draw Badge
        if (badgeB64) {
            // bottom left
            doc.addImage(badgeB64, 'PNG', 30, 150, 40, 40, undefined, 'FAST');
        }

        // Draw Signature
        if (sigB64) {
            // bottom right
            doc.addImage(sigB64, 'PNG', 200, 150, 60, 25, undefined, 'FAST');
        }
        
        // Title
        doc.setFontSize(40);
        doc.setFont('helvetica', 'bold');
        doc.text('Certificate of Completion', 148.5, 50, { align: 'center' });
        
        // Subtitle
        doc.setFontSize(20);
        doc.setFont('helvetica', 'normal');
        doc.text('This is to certify that', 148.5, 75, { align: 'center' });
        
        // Candidate Name
        doc.setFontSize(30);
        doc.setFont('helvetica', 'italic');
        const candidateName = candidate.full_name || candidate.email || 'Candidate';
        doc.text(candidateName, 148.5, 95, { align: 'center' });
        
        // Exam Info
        doc.setFontSize(16);
        doc.setFont('helvetica', 'normal');
        doc.text('has successfully completed the exam:', 148.5, 115, { align: 'center' });
        
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text(exam.title || 'Assessment', 148.5, 130, { align: 'center' });
        
        // Score Info
        doc.setFontSize(16);
        doc.setFont('helvetica', 'normal');
        doc.text(`with an Academic Score of ${data.academic_score}%`, 148.5, 145, { align: 'center' });
        
        // Footer Details
        doc.setFontSize(14);
        doc.text(`Awarded by: ${tenant.name || 'Organization'}`, 148.5, 170, { align: 'center' });
        doc.text(`Date: ${new Date(data.created_date || Date.now()).toLocaleDateString()}`, 148.5, 180, { align: 'center' });
        
        const pdfBytes = doc.output('arraybuffer');
        const safeTitle = (exam.title || 'exam').replace(/[^a-z0-9]/gi, '_');
        const file = new File([pdfBytes], `Certificate_${safeTitle}.pdf`, { type: 'application/pdf' });
        
        const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({ file });
        
        // Update result record with the file URL
        await base44.asServiceRole.entities.Result.update(data.id, {
            certificate_url: uploadRes.file_url
        });
        
        return Response.json({ success: true, certificate_url: uploadRes.file_url });
    } catch (error) {
        console.error(error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});