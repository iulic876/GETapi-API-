import { Router, Request, Response } from 'express';
import pool from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET all collections for user's workspace
router.get('/', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.user!.workspace_id;
    
    const result = await pool.query(
      `
      SELECT
          c.id,
          c.name,
          c.description,
          c.workspace_id,
          c.created_by,
          c.created_at,
          c.updated_at,
          u.name as created_by_name,
          COALESCE(
              (
                  SELECT json_agg(r.* ORDER BY r.created_at ASC)
                  FROM requests r
                  WHERE r.collection_id = c.id
              ),
              '[]'::json
          ) as requests
      FROM
          collections c
      LEFT JOIN
          users u ON c.created_by = u.id
      WHERE
          c.workspace_id = $1
      GROUP BY
          c.id, u.name
      ORDER BY
          c.created_at DESC
      `,
      [workspaceId]
    );

    res.status(200).json({
      collections: result.rows
    });
  } catch (error) {
    console.error('Get collections error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET single collection with its requests
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const workspaceId = req.user!.workspace_id;
    
    // Get collection
    const collectionResult = await pool.query(
      `SELECT c.*, u.name as created_by_name
       FROM collections c
       LEFT JOIN users u ON c.created_by = u.id
       WHERE c.id = $1 AND c.workspace_id = $2`,
      [id, workspaceId]
    );

    if (collectionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    // Get requests for this collection
    const requestsResult = await pool.query(
      `SELECT r.*, u.name as created_by_name
       FROM requests r
       LEFT JOIN users u ON r.created_by = u.id
       WHERE r.collection_id = $1
       ORDER BY r.created_at ASC`,
      [id]
    );

    res.status(200).json({
      collection: collectionResult.rows[0],
      requests: requestsResult.rows
    });
  } catch (error) {
    console.error('Get collection error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST create collection
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    const workspaceId = req.user!.workspace_id;
    const userId = req.user!.id;

    if (!name) {
      return res.status(400).json({ error: 'Collection name is required' });
    }

    const result = await pool.query(
      `INSERT INTO collections (name, description, workspace_id, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, description || '', workspaceId, userId]
    );

    res.status(201).json({
      message: 'Collection created successfully',
      collection: result.rows[0]
    });
  } catch (error) {
    console.error('Create collection error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT update collection
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const workspaceId = req.user!.workspace_id;

    if (!name && !description) {
      return res.status(400).json({ error: 'At least one field to update is required' });
    }

    let query = 'UPDATE collections SET updated_at = CURRENT_TIMESTAMP';
    const values: any[] = [];
    let paramCount = 1;

    if (name) {
      query += `, name = $${paramCount}`;
      values.push(name);
      paramCount++;
    }

    if (description !== undefined) {
      query += `, description = $${paramCount}`;
      values.push(description);
      paramCount++;
    }

    query += ` WHERE id = $${paramCount} AND workspace_id = $${paramCount + 1} RETURNING *`;
    values.push(id, workspaceId);

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    res.status(200).json({
      message: 'Collection updated successfully',
      collection: result.rows[0]
    });
  } catch (error) {
    console.error('Update collection error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE collection
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const workspaceId = req.user!.workspace_id;
    
    const result = await pool.query(
      'DELETE FROM collections WHERE id = $1 AND workspace_id = $2 RETURNING *',
      [id, workspaceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    res.status(200).json({
      message: 'Collection deleted successfully',
      collection: result.rows[0]
    });
  } catch (error) {
    console.error('Delete collection error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 