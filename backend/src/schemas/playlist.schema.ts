import { z } from 'zod';
import { trackSchema } from './track.schema';

export const createPlaylistSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240).optional()
});

export const updatePlaylistSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(240).nullable().optional()
});

export const addTrackSchema = z.object({
  track: trackSchema
});

export const favoriteTrackSchema = trackSchema;
