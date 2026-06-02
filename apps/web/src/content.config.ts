import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const lessons = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/lessons' }),
  schema: z.object({
    title: z.string(),
    track: z.string(),
    order: z.number().default(100),
    summary: z.string(),
    difficulty: z.enum(['intro', 'easy', 'medium', 'hard']).default('intro'),
    draft: z.boolean().default(false),
  }),
});

export const collections = { lessons };
