import type { Request, Response } from 'express';
import { z } from 'zod';
import { audiusService } from './audius.service';

const searchQuerySchema = z.object({
  q: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0)
});

const trackParamsSchema = z.object({
  id: z.string().min(1)
});

export const searchTracks = async (request: Request, response: Response): Promise<void> => {
  const { q, limit, offset } = searchQuerySchema.parse(request.query);
  const { tracks, hasMore } = await audiusService.searchTracks(q, limit, offset);

  response.json({ tracks, hasMore });
};

export const getTrack = async (request: Request, response: Response): Promise<void> => {
  const { id } = trackParamsSchema.parse(request.params);
  const track = await audiusService.getTrack(id);

  response.json({ track });
};
