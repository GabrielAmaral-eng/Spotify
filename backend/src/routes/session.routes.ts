import { Router } from 'express';
import { createSession } from '../controllers/session.controller';
import { asyncHandler } from '../utils/async-handler';

export const sessionRouter = Router();

sessionRouter.post('/', asyncHandler(createSession));
