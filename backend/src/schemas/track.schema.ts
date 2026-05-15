import { z } from 'zod';

export const trackSchema = z.object({
  id: z.string().min(1),
  source: z.literal('spotify').optional(),
  title: z.string().min(1),
  artist: z.string().min(1),
  album: z.string().min(1),
  thumbnail: z.string().url().or(z.literal('')),
  duration: z.number().int().nonnegative(),
  previewUrl: z.string().url().nullable().optional()
});

export type TrackPayload = z.infer<typeof trackSchema>;
