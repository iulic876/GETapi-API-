import { Router, Request, Response } from 'express';
import pool from '../config/database.js';

const router = Router();

// Get workspace by user ID
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const result = await pool.query(
      `SELECT w.*, u.name as owner_name 
       FROM workspaces w 
       JOIN users u ON u.id = w.owner_id 
       WHERE w.owner_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No workspace found for this user' });
    }

    res.status(200).json({
      workspace: result.rows[0]
    });
  } catch (error) {
    console.error('Workspace fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get workspace by ID
router.get('/:workspaceId', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.params.workspaceId;
    const result = await pool.query(
      `SELECT w.*, u.name as owner_name,
       (SELECT COUNT(*) FROM workspace_members wm WHERE wm.workspace_id = w.id) as member_count
       FROM workspaces w 
       JOIN users u ON u.id = w.owner_id 
       WHERE w.id = $1`,
      [workspaceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    res.status(200).json({
      workspace: result.rows[0]
    });
  } catch (error) {
    console.error('Workspace fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 