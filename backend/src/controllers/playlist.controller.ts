import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  addTrackSchema,
  createPlaylistSchema,
  updatePlaylistSchema
} from '../schemas/playlist.schema';
import type { Track } from '../types/track';
import { HttpError } from '../utils/http-error';
import { prisma } from '../utils/prisma';

const idParamsSchema = z.object({
  id: z.string().uuid()
});

const removeTrackParamsSchema = z.object({
  id: z.string().uuid(),
  trackId: z.string().min(1)
});

const requireSessionId = (request: Request): string => {
  if (!request.sessionId) {
    throw new HttpError('Sessão ausente.', 401);
  }

  return request.sessionId;
};

const mapTrack = (track: {
  trackId: string;
  title: string;
  artist: string;
  album: string;
  thumbnail: string;
  duration: number;
  previewUrl: string | null;
}): Track => ({
  id: track.trackId,
  source: 'spotify',
  title: track.title,
  artist: track.artist,
  album: track.album,
  thumbnail: track.thumbnail,
  duration: track.duration,
  previewUrl: track.previewUrl
});

const playlistInclude = {
  tracks: {
    orderBy: {
      order: 'asc' as const
    }
  }
};

const mapPlaylist = (playlist: {
  id: string;
  name: string;
  description: string | null;
  cover: string | null;
  createdAt: Date;
  tracks: Array<{
    trackId: string;
    title: string;
    artist: string;
    album: string;
    thumbnail: string;
    duration: number;
    previewUrl: string | null;
  }>;
}) => ({
  id: playlist.id,
  name: playlist.name,
  description: playlist.description ?? undefined,
  cover: playlist.cover ?? undefined,
  tracks: playlist.tracks.map(mapTrack),
  createdAt: playlist.createdAt.toISOString()
});

export const listPlaylists = async (request: Request, response: Response): Promise<void> => {
  const sessionId = requireSessionId(request);
  const playlists = await prisma.playlist.findMany({
    where: { sessionId },
    include: playlistInclude,
    orderBy: { createdAt: 'desc' }
  });

  response.json({ playlists: playlists.map(mapPlaylist) });
};

export const createPlaylist = async (request: Request, response: Response): Promise<void> => {
  const sessionId = requireSessionId(request);
  const data = createPlaylistSchema.parse(request.body);
  const playlist = await prisma.playlist.create({
    data: {
      name: data.name,
      description: data.description,
      sessionId
    },
    include: playlistInclude
  });

  response.status(201).json({ playlist: mapPlaylist(playlist) });
};

export const getPlaylist = async (request: Request, response: Response): Promise<void> => {
  const sessionId = requireSessionId(request);
  const { id } = idParamsSchema.parse(request.params);
  const playlist = await prisma.playlist.findFirst({
    where: { id, sessionId },
    include: playlistInclude
  });

  if (!playlist) {
    throw new HttpError('Playlist não encontrada.', 404);
  }

  response.json({ playlist: mapPlaylist(playlist) });
};

export const updatePlaylist = async (request: Request, response: Response): Promise<void> => {
  const sessionId = requireSessionId(request);
  const { id } = idParamsSchema.parse(request.params);
  const data = updatePlaylistSchema.parse(request.body);
  const playlist = await prisma.playlist.findFirst({
    where: { id, sessionId },
    select: { id: true }
  });

  if (!playlist) {
    throw new HttpError('Playlist não encontrada.', 404);
  }

  const updated = await prisma.playlist.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description
    },
    include: playlistInclude
  });

  response.json({ playlist: mapPlaylist(updated) });
};

export const deletePlaylist = async (request: Request, response: Response): Promise<void> => {
  const sessionId = requireSessionId(request);
  const { id } = idParamsSchema.parse(request.params);
  const result = await prisma.playlist.deleteMany({
    where: { id, sessionId }
  });

  if (result.count === 0) {
    throw new HttpError('Playlist não encontrada.', 404);
  }

  response.status(204).send();
};

export const addTrackToPlaylist = async (request: Request, response: Response): Promise<void> => {
  const sessionId = requireSessionId(request);
  const { id } = idParamsSchema.parse(request.params);
  const { track } = addTrackSchema.parse(request.body);
  const playlist = await prisma.playlist.findFirst({
    where: { id, sessionId },
    select: { id: true }
  });

  if (!playlist) {
    throw new HttpError('Playlist não encontrada.', 404);
  }

  const orderAggregate = await prisma.playlistTrack.aggregate({
    where: { playlistId: id },
    _max: { order: true }
  });

  const nextOrder = (orderAggregate._max.order ?? -1) + 1;

  await prisma.playlistTrack.upsert({
    where: {
      playlistId_trackId: {
        playlistId: id,
        trackId: track.id
      }
    },
    create: {
      playlistId: id,
      trackId: track.id,
      title: track.title,
      artist: track.artist,
      album: track.album,
      thumbnail: track.thumbnail,
      duration: track.duration,
      previewUrl: track.previewUrl ?? null,
      order: nextOrder
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

  const updated = await prisma.playlist.findUniqueOrThrow({
    where: { id },
    include: playlistInclude
  });

  response.status(201).json({ playlist: mapPlaylist(updated) });
};

export const removeTrackFromPlaylist = async (request: Request, response: Response): Promise<void> => {
  const sessionId = requireSessionId(request);
  const { id, trackId } = removeTrackParamsSchema.parse(request.params);
  const playlist = await prisma.playlist.findFirst({
    where: { id, sessionId },
    select: { id: true }
  });

  if (!playlist) {
    throw new HttpError('Playlist não encontrada.', 404);
  }

  await prisma.playlistTrack.deleteMany({
    where: {
      playlistId: id,
      trackId
    }
  });

  response.status(204).send();
};
