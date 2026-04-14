'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateFocusInsightsInputSchema = z.object({
  alignmentScore: z.number().min(0).max(100),
  trackedMinutes: z.number().min(0),
  categoryBreakdown: z.array(
    z.object({
      label: z.string(),
      alignment: z.number().min(0).max(100),
      trackedMinutes: z.number().min(0),
    })
  ),
  topDeviations: z.array(
    z.object({
      summary: z.string(),
      pointImpact: z.number(),
      duration: z.number(),
    })
  ),
});

export type GenerateFocusInsightsInput = z.infer<typeof GenerateFocusInsightsInputSchema>;

const GenerateFocusInsightsOutputSchema = z.object({
  insights: z.array(z.string()).min(1).max(4),
});

export type GenerateFocusInsightsOutput = z.infer<typeof GenerateFocusInsightsOutputSchema>;

export async function generateFocusInsights(
  input: GenerateFocusInsightsInput
): Promise<GenerateFocusInsightsOutput> {
  return generateFocusInsightsFlow(input);
}

const generateFocusInsightsPrompt = ai.definePrompt({
  name: 'generateFocusInsightsPrompt',
  input: { schema: GenerateFocusInsightsInputSchema },
  output: { schema: GenerateFocusInsightsOutputSchema },
  prompt: `You are a productivity coach inside FocusWeave.

The user just completed an Adaptive Focus Auditor session.

Alignment score: {{{alignmentScore}}}/100
Tracked minutes: {{{trackedMinutes}}}

Category breakdown:
{{#each categoryBreakdown}}
- {{label}}: {{alignment}}% alignment across {{trackedMinutes}} minutes
{{/each}}

Top deviations:
{{#each topDeviations}}
- {{summary}} (impact: {{pointImpact}}, duration: {{duration}} min)
{{/each}}

Write 3 to 4 concise, specific coaching insights.

Rules:
- Be practical and actionable.
- Mention concrete weak spots when possible.
- Recognize strengths too when the data supports it.
- Avoid fluff and generic motivational language.
- Return only the structured insights array.`,
});

const generateFocusInsightsFlow = ai.defineFlow(
  {
    name: 'generateFocusInsightsFlow',
    inputSchema: GenerateFocusInsightsInputSchema,
    outputSchema: GenerateFocusInsightsOutputSchema,
  },
  async (input) => {
    const { output } = await generateFocusInsightsPrompt(input);
    return output ?? { insights: ['AI insights were unavailable, so FocusWeave used fallback coaching guidance instead.'] };
  }
);
