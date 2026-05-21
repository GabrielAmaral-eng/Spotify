import { Router } from 'express';
import { authMiddleware } from '../auth/auth.middleware';
import { asyncHandler } from '../../utils/async-handler';
import {
  addTrackToPlaylist,
  createPlaylist,
  deletePlaylist,
  favoriteTrack,
  getPlaylist,
  listFavorites,
  listPlaylists,
  removeTrackFromPlaylist,
  unfavoriteTrack,
  updatePlaylist
} from './library.controller';

export const libraryRouter = Router();

libraryRouter.use(authMiddleware);
libraryRouter.get('/playlists', asyncHandler(listPlaylists));
libraryRouter.post('/playlists', asyncHandler(createPlaylist));
libraryRouter.get('/playlists/:id', asyncHandler(getPlaylist));
libraryRouter.put('/playlists/:id', asyncHandler(updatePlaylist));
libraryRouter.delete('/playlists/:id', asyncHandler(deletePlaylist));
libraryRouter.post('/playlists/:id/tracks', asyncHandler(addTrackToPlaylist));
libraryRouter.delete('/playlists/:id/tracks/:trackId', asyncHandler(removeTrackFromPlaylist));
libraryRouter.get('/favorites', asyncHandler(listFavorites));
libraryRouter.post('/favorites', asyncHandler(favoriteTrack));
libraryRouter.delete('/favorites/:trackId', asyncHandler(unfavoriteTrack));
