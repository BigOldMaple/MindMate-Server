// server/types.ts
import { Request } from 'express';
import { IUser } from '../Database/Schema';

export interface AuthenticatedRequest extends Request {
  user?: IUser;
}

export interface ApiResponse<T> {
  data: T;
  error?: never;
}

export interface ApiError {
  error: string;
  data?: never;
}

export type ApiResult<T> = ApiResponse<T> | ApiError;