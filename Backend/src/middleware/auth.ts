import { Request, Response, NextFunction } from 'express';
import { getDb } from '../db/database.js';
import { User } from '../db/types.js';

declare global {
  namespace Express {
    interface Request {
      currentUser?: User;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const queryUserId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
  const requestedUserId = (req.header('x-user-id') || queryUserId || 'user-alice').trim();
  const db = getDb();

  const user = db
    .prepare('SELECT id, name, email, role_title, avatar_color, created_at FROM users WHERE id = ?')
    .get(requestedUserId) as User | undefined;

  if (!user) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED_USER',
        message: `User '${requestedUserId}' not found.`
      }
    });
    return;
  }

  req.currentUser = user;
  next();
}
