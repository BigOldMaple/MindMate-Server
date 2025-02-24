// server/middleware/error.ts
import { Request, Response, NextFunction } from 'express';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: err.message
    });
  }

  console.error('Unhandled error:', err);
  return res.status(500).json({
    error: 'Internal server error'
  });
};