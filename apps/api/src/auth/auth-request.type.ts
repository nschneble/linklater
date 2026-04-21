import { Request } from 'express';

export interface AuthUser {
  email: string;
  userId: string;
}

export interface AuthRequest extends Request {
  user: AuthUser;
}
