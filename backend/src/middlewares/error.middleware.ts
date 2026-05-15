import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../utils/http-error';

export const errorMiddleware = (
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction
): void => {
  if (error instanceof ZodError) {
    response.status(400).json({
      error: error.issues[0]?.message ?? 'Payload inválido.',
      statusCode: 400
    });
    return;
  }

  if (error instanceof HttpError) {
    response.status(error.statusCode).json({
      error: error.message,
      statusCode: error.statusCode
    });
    return;
  }

  console.error(error);
  response.status(500).json({
    error: 'Erro interno do servidor.',
    statusCode: 500
  });
};
