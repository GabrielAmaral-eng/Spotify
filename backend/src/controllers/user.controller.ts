import type { Request, Response } from 'express';
import { z } from 'zod';
import { favoriteTrackSchema } from '../schemas/playlist.schema';
import type { Track } from '../types/track';
import { HttpError } from '../utils/http-error';
import { prisma } from '../utils/prisma';

const favoriteParamsSchema = z.object({
  trackId: z.string().min(1)
});

const requireSessionId = (request: Request): string => {
  if (!request.sessionId) {
    throw new HttpError('Sessão ausente.', 401);
  }

  return request.sessionId;
};

const mapFavorite = (favorite: {
  trackId: string;
  title: string;
  artist: string;
  album: string;
  thumbnail: string;
  duration: number;
  previewUrl: string | null;
}): Track => ({
  id: favorite.trackId,
  source: 'spotify',
  title: favorite.title,
  artist: favorite.artist,
  album: favorite.album,
  thumbnail: favorite.thumbnail,
  duration: favorite.duration,
  previewUrl: favorite.previewUrl
});

export const listFavorites = async (request: Request, response: Response): Promise<void> => {
  const sessionId = requireSessionId(request);
  const favorites = await prisma.favorite.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'desc' }
  });

  response.json({ favorites: favorites.map(mapFavorite) });
};

export const favoriteTrack = async (request: Request, response: Response): Promise<void> => {
  const sessionId = requireSessionId(request);
  const track = favoriteTrackSchema.parse(request.body);

  const favorite = await prisma.favorite.upsert({
    where: {
      sessionId_trackId: {
        sessionId,
        trackId: track.id
      }
    },
    create: {
      sessionId,
      trackId: track.id,
      title: track.title,
      artist: track.artist,
      album: track.album,
      thumbnail: track.thumbnail,
      duration: track.duration,
      previewUrl: track.previewUrl ?? null
    },
    update: {
      title: track.title,
      artist: track.artist,
      album: track.album,
      thumbnail: track.thumbnail,
      duration: track.duration,
      previewUrl: track.previewUrl ?? null
    }
  });

  response.status(201).json({ favorite: mapFavorite(favorite) });
};

export const unfavoriteTrack = async (request: Request, response: Response): Promise<void> => {
  const sessionId = requireSessionId(request);
  const { trackId } = favoriteParamsSchema.parse(request.params);

  await prisma.favorite.deleteMany({
    where: {
      sessionId,
      trackId
    }
  });

  response.status(204).send();
};
