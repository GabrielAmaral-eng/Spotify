import type { NextFunction, Request, Response } from 'express';

type AsyncRoute = (request: Request, response: Response, next: NextFunction) => Promise<void>;

export const asyncHandler =
  (route: AsyncRoute) => (request: Request, response: Response, next: NextFunction): void => {
    route(request, response, next).catch(next);
  };
