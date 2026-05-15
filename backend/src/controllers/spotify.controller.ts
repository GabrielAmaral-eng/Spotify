import type { Request, Response } from 'express';
import { z } from 'zod';
import { spotifyService } from '../services/spotify.service';

const searchQuerySchema = z.object({
  q: z.string().trim().min(1)
});

const trackParamsSchema = z.object({
  id: z.string().min(1)
});

export const searchTracks = async (request: Request, response: Response): Promise<void> => {
  const { q } = searchQuerySchema.parse(request.query);
  const tracks = await spotifyService.searchTracks(q);

  response.json({ tracks });
};

export const getTrack = async (request: Request, response: Response): Promise<void> => {
  const { id } = trackParamsSchema.parse(request.params);
  const track = await spotifyService.getTrack(id);

  response.json({ track });
};
