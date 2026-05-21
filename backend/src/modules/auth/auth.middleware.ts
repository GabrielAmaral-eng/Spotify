import type { NextFunction, Request, Response } from 'express';
import { supabaseAuthClient } from '../../lib/supabase';

export const authMiddleware = async (
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> => {
  const authorization = request.header('Authorization');
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!accessToken) {
    response.status(401).json({
      error: 'Token Bearer é obrigatório.',
      statusCode: 401
    });
    return;
  }

  const { data, error } = await supabaseAuthClient.auth.getUser(accessToken);

  if (error || !data.user) {
    response.status(401).json({
      error: 'Token inválido ou expirado.',
      statusCode: 401
    });
    return;
  }

  request.userId = data.user.id;
  request.accessToken = accessToken;
  next();
};
