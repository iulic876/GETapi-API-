import { Request, Response, NextFunction } from 'express';
import pool from '../config/database.js';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        name: string;
        workspace_id: number;
        workspace_name: string;
      };
    }
  }
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // For now, get user ID from query param or header (in real app, this would be JWT token)
    const userId = req.query.userId || req.headers['user-id'];
    
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const result = await pool.query(
      `SELECT u.id, u.email, u.name, 
              w.id as workspace_id, w.name as workspace_name
       FROM users u
       LEFT JOIN workspaces w ON w.owner_id = u.id
       WHERE u.id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      workspace_id: user.workspace_id,
      workspace_name: user.workspace_name
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}; 