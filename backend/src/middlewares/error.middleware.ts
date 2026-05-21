import type { NextFunction, Request, Response } from 'express';
import axios from 'axios';
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

  if (axios.isAxiosError(error)) {
    const statusCode = error.response?.status ?? 502;
    const providerError =
      typeof error.response?.data === 'object' &&
      error.response?.data !== null &&
      'error' in error.response.data
        ? (error.response.data as { error?: unknown }).error
        : undefined;
    const providerMessage =
      typeof providerError === 'string'
        ? providerError
        : typeof providerError === 'object' &&
            providerError !== null &&
            'message' in providerError
          ? String((providerError as { message?: unknown }).message)
          : undefined;

    console.error('Falha em requisicao externa:', {
      code: error.code,
      statusCode,
      message: error.message,
      data: error.response?.data
    });

    response.status(statusCode >= 500 ? 502 : statusCode).json({
      error: providerMessage ?? 'Falha ao consultar servico externo.',
      statusCode: statusCode >= 500 ? 502 : statusCode
    });
    return;
  }

  console.error(error);
  response.status(500).json({
    error: 'Erro interno do servidor.',
    statusCode: 500
  });
};
