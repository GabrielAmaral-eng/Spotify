import { z } from 'zod';

export const trackSchema = z.object({
  id: z.string().min(1),
  source: z.literal('audius').optional(),
  title: z.string().min(1),
  artist: z.string().min(1),
  album: z.string().min(1),
  thumbnail: z.string().url().or(z.literal('')),
  duration: z.number().int().nonnegative(),
  previewUrl: z.string().url().nullable().optional()
});

export const createPlaylistSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240).optional()
});

export const updatePlaylistSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240).nullable().optional()
});

export const addTrackSchema = z.object({
  track: trackSchema
});

export const favoriteTrackSchema = trackSchema;
