import { Router } from 'express';
import { getTrack, searchTracks } from '../controllers/spotify.controller';
import { asyncHandler } from '../utils/async-handler';

export const spotifyRouter = Router();

spotifyRouter.get('/search', asyncHandler(searchTracks));
spotifyRouter.get('/track/:id', asyncHandler(getTrack));
