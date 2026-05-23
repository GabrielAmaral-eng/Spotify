import type { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { HttpError } from '../../utils/http-error';
import { spotifyAuthService } from './spotify-auth.service';

const callbackQuerySchema = z.object({
  code: z.string().min(1).optional(),
  error: z.string().min(1).optional(),
  state: z.string().min(1)
});

const playBodySchema = z.object({
  deviceId: z.string().trim().min(1),
  trackId: z.string().trim().min(1)
});

export const createSpotifyAuthorizationUrl = async (
  request: Request,
  response: Response
): Promise<void> => {
  if (!request.userId) {
    throw new HttpError('Usuario nao autenticado.', 401);
  }

  response.json({
    authorizeUrl: spotifyAuthService.createAuthorizationUrl(request.userId)
  });
};

export const handleSpotifyCallback = async (
  request: Request,
  response: Response
): Promise<void> => {
  const { code, error, state } = callbackQuerySchema.parse(request.query);
  const redirectUrl = new URL('/home', env.FRONTEND_URL);

  if (error) {
    redirectUrl.searchParams.set('spotify', 'denied');
    response.redirect(redirectUrl.toString());
    return;
  }

  if (!code) {
    throw new HttpError('Codigo OAuth ausente.', 400);
  }

  await spotifyAuthService.connectFromCallback(code, state);

  redirectUrl.searchParams.set('spotify', 'connected');
  response.redirect(redirectUrl.toString());
};

export const getSpotifyConnectionStatus = async (
  request: Request,
  response: Response
): Promise<void> => {
  if (!request.userId) {
    throw new HttpError('Usuario nao autenticado.', 401);
  }

  response.json(await spotifyAuthService.getStatus(request.userId));
};

export const getSpotifyAccessToken = async (
  request: Request,
  response: Response
): Promise<void> => {
  if (!request.userId) {
    throw new HttpError('Usuario nao autenticado.', 401);
  }

  response.json(await spotifyAuthService.getAccessToken(request.userId));
};

export const disconnectSpotify = async (
  request: Request,
  response: Response
): Promise<void> => {
  if (!request.userId) {
    throw new HttpError('Usuario nao autenticado.', 401);
  }

  await spotifyAuthService.disconnect(request.userId);
  response.status(204).send();
};

export const playSpotifyTrack = async (
  request: Request,
  response: Response
): Promise<void> => {
  if (!request.userId) {
    throw new HttpError('Usuario nao autenticado.', 401);
  }

  const { deviceId, trackId } = playBodySchema.parse(request.body);
  await spotifyAuthService.playTrack(request.userId, deviceId, trackId);

  response.status(204).send();
};
