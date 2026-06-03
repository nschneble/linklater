import { z } from 'zod';

export const storyStepSchema = z.object({
  action: z.string().min(1),
  parameters: z.record(z.string(), z.string()).optional(),
});

export type StoryStep = z.infer<typeof storyStepSchema>;

export const storySchema = z.object({
  story: z.string().min(1),
  storageState: z.enum(['fresh', 'logged-in']).default('fresh'),
  actions: z.array(storyStepSchema).min(1),
});

export type Story = z.infer<typeof storySchema>;
