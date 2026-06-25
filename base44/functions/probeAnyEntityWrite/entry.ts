import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Compare: try writing a BankQuestion (which has a tenant_id) to see if writes work at all
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;

    const bankBefore = await sr.entities.BankQuestion.list();

    const bq = await sr.entities.BankQuestion.create({
      tenant_id: 'probe-tenant',
      question_text: 'PROBE_QUESTION_' + Date.now(),
      option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D',
      correct_option: 'A',
    });

    const bankAfter = await sr.entities.BankQuestion.list();

    return Response.json({
      bank_before: bankBefore.length,
      bank_after: bankAfter.length,
      created_bq: bq,
      bank_after_sample: bankAfter.slice(0, 3).map(b => ({ id: b.id, text: b.question_text })),
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});