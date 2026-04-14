import { gemini20FlashLite, googleAI } from '@genkit-ai/googleai';
import { genkit, z } from 'genkit';

const ai = genkit({
  plugins: [googleAI()],
  model: gemini20FlashLite,
});

export const AuditTaskAlignmentInputSchema = z.object({
  doneTasks: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    duration: z.number().optional(), // Expected duration if available
    startTime: z.string().optional(),
    endTime: z.string().optional(),
  })),
  activityLogs: z.array(z.object({
    id: z.string(),
    timestamp: z.string(),
    duration: z.number(),
    activity: z.string(), // Description/Site Name
  })),
});

export const AuditTaskAlignmentOutputSchema = z.object({
  alignmentScore: z.number(),
  totalTrackedMinutes: z.number(),
  alignedMinutes: z.number(),
  taskBreakdown: z.array(z.object({
    taskId: z.string(),
    taskName: z.string(),
    actualMinutes: z.number(),
    alignmentPercentage: z.number(),
  })),
  unrelatedMinutes: z.number(),
  insights: z.array(z.string()),
});

export type AuditTaskAlignmentInput = z.infer<typeof AuditTaskAlignmentInputSchema>;
export type AuditTaskAlignmentOutput = z.infer<typeof AuditTaskAlignmentOutputSchema>;

export const auditTaskAlignment = ai.defineFlow(
  {
    name: 'auditTaskAlignment',
    inputSchema: AuditTaskAlignmentInputSchema,
    outputSchema: AuditTaskAlignmentOutputSchema,
  },
  async (input) => {
    const { doneTasks, activityLogs } = input;

    if (activityLogs.length === 0) {
      return {
        alignmentScore: 0,
        totalTrackedMinutes: 0,
        alignedMinutes: 0,
        taskBreakdown: [],
        unrelatedMinutes: 0,
        insights: ["Please input activity logs to see insights."],
      };
    }

    const { output } = await ai.generate({
      system: `You are a Productivity Auditor. Your job is to compare a user's "Done Tasks" with their actual "Activity Logs".
        
        CRITICAL RULES:
        1. MAP ACTIVITIES TO TASKS: Use semantic similarity to map activity descriptions (which might be URLs or site names) to the done tasks.
           - Example: "github.com/repo/issues" maps to a "Fix bugs" task.
           - Example: "youtube.com/coding-tutorial" maps to "Learn React" task.
           - Use startTime and endTime of tasks as context to help map activity logs if the timestamps are close, but prioritize duration-based matching.
           - If an activity is clearly a distraction (e.g., "social media", "netflix"), do NOT map it to any task.
        2. CALCULATE DURATIONS: Sum the minutes for every activity mapped to a specific task.
        3. SCORE: The Alignment Score is (Aligned Minutes / Total Minutes) * 100.
        4. INSIGHTS: Provide 3-4 actionable insights. Be specific. Mention tasks by name.
        
        OUTPUT FORMAT: You MUST return a JSON object sticking to the AuditTaskAlignmentOutputSchema.`,
      prompt: `Done Tasks: ${JSON.stringify(doneTasks)}
               Activity Logs: ${JSON.stringify(activityLogs)}`,
      output: { format: 'json', schema: AuditTaskAlignmentOutputSchema },
    });

    if (!output) {
      throw new Error('AI failed to generate audit output.');
    }

    return output;
  }
);
