import type { Request, Response } from 'express';
import { z } from 'zod';
import { HttpError } from '../../utils/http-error';
import {
  addTrackSchema,
  createPlaylistSchema,
  favoriteTrackSchema,
  updatePlaylistSchema
} from './library.schemas';
import { libraryService } from './library.service';

const playlistParamsSchema = z.object({
  id: z.string().uuid()
});

const removeTrackParamsSchema = z.object({
  id: z.string().uuid(),
  trackId: z.string().min(1)
});

const favoriteParamsSchema = z.object({
  trackId: z.string().min(1)
});

const requireAuth = (request: Request): { accessToken: string; userId: string } => {
  if (!request.accessToken || !request.userId) {
    throw new HttpError('Usuário não autenticado.', 401);
  }

  return {
    accessToken: request.accessToken,
    userId: request.userId
  };
};

export const listPlaylists = async (request: Request, response: Response): Promise<void> => {
  const { accessToken } = requireAuth(request);
  const playlists = await libraryService.listPlaylists(accessToken);

  response.json({ playlists });
};

export const createPlaylist = async (request: Request, response: Response): Promise<void> => {
  const { accessToken, userId } = requireAuth(request);
  const data = createPlaylistSchema.parse(request.body);
  const playlist = await libraryService.createPlaylist(
    accessToken,
    userId,
    data.name,
    data.description
  );

  response.status(201).json({ playlist });
};

export const getPlaylist = async (request: Request, response: Response): Promise<void> => {
  const { accessToken } = requireAuth(request);
  const { id } = playlistParamsSchema.parse(request.params);
  const playlist = await libraryService.getPlaylist(accessToken, id);

  response.json({ playlist });
};

export const updatePlaylist = async (request: Request, response: Response): Promise<void> => {
  const { accessToken } = requireAuth(request);
  const { id } = playlistParamsSchema.parse(request.params);
  const data = updatePlaylistSchema.parse(request.body);
  const playlist = await libraryService.updatePlaylist(
    accessToken,
    id,
    data.name,
    data.description
  );

  response.json({ playlist });
};

export const deletePlaylist = async (request: Request, response: Response): Promise<void> => {
  const { accessToken } = requireAuth(request);
  const { id } = playlistParamsSchema.parse(request.params);
  await libraryService.deletePlaylist(accessToken, id);

  response.status(204).send();
};

export const addTrackToPlaylist = async (request: Request, response: Response): Promise<void> => {
  const { accessToken } = requireAuth(request);
  const { id } = playlistParamsSchema.parse(request.params);
  const { track } = addTrackSchema.parse(request.body);
  const playlist = await libraryService.addTrackToPlaylist(accessToken, id, {
    id: track.id,
    source: 'audius',
    title: track.title,
    artist: track.artist,
    album: track.album,
    thumbnail: track.thumbnail,
    duration: track.duration,
    previewUrl: track.previewUrl ?? null
  });

  response.status(201).json({ playlist });
};

export const removeTrackFromPlaylist = async (
  request: Request,
  response: Response
): Promise<void> => {
  const { accessToken } = requireAuth(request);
  const { id, trackId } = removeTrackParamsSchema.parse(request.params);
  await libraryService.removeTrackFromPlaylist(accessToken, id, trackId);

  response.status(204).send();
};

export const listFavorites = async (request: Request, response: Response): Promise<void> => {
  const { accessToken } = requireAuth(request);
  const favorites = await libraryService.listFavorites(accessToken);

  response.json({ favorites });
};

export const favoriteTrack = async (request: Request, response: Response): Promise<void> => {
  const { accessToken, userId } = requireAuth(request);
  const track = favoriteTrackSchema.parse(request.body);
  const favorite = await libraryService.favoriteTrack(accessToken, userId, {
    id: track.id,
    source: 'audius',
    title: track.title,
    artist: track.artist,
    album: track.album,
    thumbnail: track.thumbnail,
    duration: track.duration,
    previewUrl: track.previewUrl ?? null
  });

  response.status(201).json({ favorite });
};

export const unfavoriteTrack = async (request: Request, response: Response): Promise<void> => {
  const { accessToken } = requireAuth(request);
  const { trackId } = favoriteParamsSchema.parse(request.params);
  await libraryService.unfavoriteTrack(accessToken, trackId);

  response.status(204).send();
};
