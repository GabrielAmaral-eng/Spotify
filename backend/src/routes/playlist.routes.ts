import { Router } from 'express';
import {
  addTrackToPlaylist,
  createPlaylist,
  deletePlaylist,
  getPlaylist,
  listPlaylists,
  removeTrackFromPlaylist,
  updatePlaylist
} from '../controllers/playlist.controller';
import { sessionMiddleware } from '../middlewares/session.middleware';
import { asyncHandler } from '../utils/async-handler';

export const playlistRouter = Router();

playlistRouter.use(sessionMiddleware);
playlistRouter.get('/', asyncHandler(listPlaylists));
playlistRouter.post('/', asyncHandler(createPlaylist));
playlistRouter.get('/:id', asyncHandler(getPlaylist));
playlistRouter.put('/:id', asyncHandler(updatePlaylist));
playlistRouter.delete('/:id', asyncHandler(deletePlaylist));
playlistRouter.post('/:id/tracks', asyncHandler(addTrackToPlaylist));
playlistRouter.delete('/:id/tracks/:trackId', asyncHandler(removeTrackFromPlaylist));
