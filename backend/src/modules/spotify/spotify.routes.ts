import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { authMiddleware } from '../auth/auth.middleware';
import { getTrack, searchTracks } from './spotify.controller';
import {
  createSpotifyAuthorizationUrl,
  disconnectSpotify,
  getSpotifyAccessToken,
  getSpotifyConnectionStatus,
  handleSpotifyCallback
} from './spotify-auth.controller';

export const spotifyRouter = Router();

spotifyRouter.get('/search', asyncHandler(searchTracks));
spotifyRouter.get('/track/:id', asyncHandler(getTrack));
spotifyRouter.get('/auth/callback', asyncHandler(handleSpotifyCallback));
spotifyRouter.get('/auth/login', authMiddleware, asyncHandler(createSpotifyAuthorizationUrl));
spotifyRouter.get('/auth/status', authMiddleware, asyncHandler(getSpotifyConnectionStatus));
spotifyRouter.get('/auth/token', authMiddleware, asyncHandler(getSpotifyAccessToken));
spotifyRouter.delete('/auth/connection', authMiddleware, asyncHandler(disconnectSpotify));
