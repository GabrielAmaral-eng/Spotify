import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';
import { HttpError } from '../utils/http-error';

export const createSession = async (_request: Request, response: Response): Promise<void> => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new HttpError('JWT_SECRET não configurado.', 500);
  }

  const sessionId = randomUUID();
  const token = jwt.sign({ sessionId }, secret);

  const session = await prisma.session.create({
    data: {
      id: sessionId,
      token
    },
    select: {
      id: true,
      token: true,
      createdAt: true
    }
  });

  response.status(201).json(session);
};
