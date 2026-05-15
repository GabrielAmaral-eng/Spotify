import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../utils/prisma';

const sessionPayloadSchema = z.object({
  sessionId: z.string().uuid()
});

export const sessionMiddleware = async (
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> => {
  const tokenHeader = request.header('X-Session-Token');

  if (!tokenHeader) {
    response.status(401).json({
      error: 'Header X-Session-Token é obrigatório.',
      statusCode: 401
    });
    return;
  }

  try {
    const decoded = jwt.verify(tokenHeader, process.env.JWT_SECRET ?? '');
    const payload = sessionPayloadSchema.parse(decoded);
    const session = await prisma.session.findFirst({
      where: {
        id: payload.sessionId,
        token: tokenHeader
      },
      select: { id: true }
    });

    if (!session) {
      response.status(401).json({
        error: 'Sessão inválida.',
        statusCode: 401
      });
      return;
    }

    request.sessionId = session.id;
    request.sessionToken = tokenHeader;
    next();
  } catch {
    response.status(401).json({
      error: 'Sessão inválida.',
      statusCode: 401
    });
  }
};
