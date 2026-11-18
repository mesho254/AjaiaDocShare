import { Router } from 'express';
import { getDb } from '../db/database.js';
import { User } from '../db/types.js';

export const usersRouter = Router();

usersRouter.get('/', (req, res) => {
  const db = getDb();
  const users = db
    .prepare('SELECT id, name, email, role_title, avatar_color, created_at FROM users ORDER BY name ASC')
    .all() as unknown as User[];

  res.json({
    users,
    currentUser: req.currentUser
  });
});
