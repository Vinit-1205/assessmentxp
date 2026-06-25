import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { questions, shuffle_questions = true, shuffle_options = true } = await req.json();
        
        if (!Array.isArray(questions)) {
             return Response.json({ error: 'Missing or invalid questions array' }, { status: 400 });
        }
        
        const randomized = questions.map(q => {
            const optionsWithOriginalIndex = (q.options || []).map((opt, idx) => ({ text: opt, originalIndex: idx }));
            
            if (shuffle_options) {
                // Fisher-Yates shuffle for options
                for (let i = optionsWithOriginalIndex.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [optionsWithOriginalIndex[i], optionsWithOriginalIndex[j]] = [optionsWithOriginalIndex[j], optionsWithOriginalIndex[i]];
                }
            }
            
            return {
                id: q.id,
                text: q.text,
                options: optionsWithOriginalIndex.map(o => o.text),
                // Return the new index of the correct option for tracking
                correct_option_index: optionsWithOriginalIndex.findIndex(o => o.originalIndex === q.correct_option_index),
                marks_awarded: q.marks_awarded || 1
            };
        });
        
        if (shuffle_questions) {
            // Fisher-Yates shuffle for questions order
            for (let i = randomized.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [randomized[i], randomized[j]] = [randomized[j], randomized[i]];
            }
        }

        return Response.json({ questions: randomized });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});