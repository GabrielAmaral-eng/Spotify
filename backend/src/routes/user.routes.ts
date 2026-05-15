import { Router } from 'express';
import {
  favoriteTrack,
  listFavorites,
  unfavoriteTrack
} from '../controllers/user.controller';
import { sessionMiddleware } from '../middlewares/session.middleware';
import { asyncHandler } from '../utils/async-handler';

export const userRouter = Router();

userRouter.use(sessionMiddleware);
userRouter.get('/favorites', asyncHandler(listFavorites));
userRouter.post('/favorites', asyncHandler(favoriteTrack));
userRouter.delete('/favorites/:trackId', asyncHandler(unfavoriteTrack));
