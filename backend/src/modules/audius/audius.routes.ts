import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { getTrack, searchTracks } from './audius.controller';

export const audiusRouter = Router();

audiusRouter.get('/search', asyncHandler(searchTracks));
audiusRouter.get('/track/:id', asyncHandler(getTrack));
