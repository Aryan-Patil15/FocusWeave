'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AINewsItemSchema = z.object({
  title: z.string().describe('A professional, clear headline for the news item. You can rewrite the raw title to be more professional.'),
  url: z.string().describe('The URL of the news item. MUST be one of the URLs provided in the rawPosts array.'),
});

const GetRelevantNewsInputSchema = z.object({
  category: z.string().describe('The intended news category.'),
  rawPosts: z.array(z.object({
    title: z.string(),
    url: z.string(),
  })).describe('List of raw posts from Reddit/internet.'),
});

export type GetRelevantNewsInput = z.infer<typeof GetRelevantNewsInputSchema>;

const GetRelevantNewsOutputSchema = z.object({
  items: z.array(AINewsItemSchema).describe('List of exactly 3 highly relevant and professional news items.'),
  source: z.string().describe('Source attribution string, e.g., "AI Curated from Community"'),
});

export type GetRelevantNewsOutput = z.infer<typeof GetRelevantNewsOutputSchema>;

export async function getRelevantNews(input: GetRelevantNewsInput): Promise<GetRelevantNewsOutput> {
  return getRelevantNewsFlow(input);
}

const getRelevantNewsPrompt = ai.definePrompt({
  name: 'getRelevantNewsPrompt',
  input: { schema: GetRelevantNewsInputSchema },
  output: { schema: GetRelevantNewsOutputSchema },
  prompt: `You are an intelligent Executive News Curator. We want to show the user useful, highly relevant, and professional news regarding: "{{category}}".
  
  The user is currently getting raw Reddit posts, which often include memes, questions, or irrelevant personal stories.
  Below is a list of raw posts fetched from the internet.
  
  Raw Posts:
  {{json rawPosts}}
  
  Your task:
  1. Evaluate these posts and select the 3 most professional, impactful, and relevant legitimate NEWS items.
  2. Ignore memes, questions (e.g., "How do I..."), self-promotion, or low-quality content. 
  3. Rewrite the selected titles to be clear, objective, and professional.
  4. Ensure you return exactly the original URL associated with your selected items.
  
  If there are not enough good items in the raw list, you can fall back to providing a high-level trend with a Google News search URL (https://news.google.com/search?q=topic).
  Return exactly 3 items.`,
});

const getRelevantNewsFlow = ai.defineFlow(
  {
    name: 'getRelevantNewsFlow',
    inputSchema: GetRelevantNewsInputSchema,
    outputSchema: GetRelevantNewsOutputSchema,
  },
  async (input) => {
    const { output } = await getRelevantNewsPrompt(input);
    return output!;
  }
);
