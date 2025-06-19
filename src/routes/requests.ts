import { Router, Request, Response } from 'express';
import pool from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET all requests for a collection
router.get('/collection/:collectionId', async (req: Request, res: Response) => {
  try {
    const { collectionId } = req.params;
    const workspaceId = req.user!.workspace_id;
    
    // Verify collection belongs to user's workspace
    const collectionCheck = await pool.query(
      'SELECT id FROM collections WHERE id = $1 AND workspace_id = $2',
      [collectionId, workspaceId]
    );

    if (collectionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    const result = await pool.query(
      `SELECT r.*, u.name as created_by_name
       FROM requests r
       LEFT JOIN users u ON r.created_by = u.id
       WHERE r.collection_id = $1
       ORDER BY r.created_at ASC`,
      [collectionId]
    );

    res.status(200).json({
      requests: result.rows
    });
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET single request
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const workspaceId = req.user!.workspace_id;
    
    const result = await pool.query(
      `SELECT r.*, u.name as created_by_name
       FROM requests r
       LEFT JOIN users u ON r.created_by = u.id
       LEFT JOIN collections c ON r.collection_id = c.id
       WHERE r.id = $1 AND c.workspace_id = $2`,
      [id, workspaceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    res.status(200).json({
      request: result.rows[0]
    });
  } catch (error) {
    console.error('Get request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST create request
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, method, url, headers, body, params, collection_id } = req.body;
    const workspaceId = req.user!.workspace_id;
    const userId = req.user!.id;

    if (!name || !method || !url || !collection_id) {
      return res.status(400).json({ 
        error: 'Name, method, URL, and collection_id are required' 
      });
    }

    // Verify collection belongs to user's workspace
    const collectionCheck = await pool.query(
      'SELECT id FROM collections WHERE id = $1 AND workspace_id = $2',
      [collection_id, workspaceId]
    );

    if (collectionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    const result = await pool.query(
      `INSERT INTO requests (name, method, url, headers, body, params, collection_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        name, 
        method.toUpperCase(), 
        url, 
        headers || {}, 
        body || {}, 
        params || {}, 
        collection_id, 
        userId
      ]
    );

    res.status(201).json({
      message: 'Request created successfully',
      request: result.rows[0]
    });
  } catch (error) {
    console.error('Create request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT update request
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, method, url, headers, body, params } = req.body;
    const workspaceId = req.user!.workspace_id;

    if (!name && !method && !url && headers === undefined && body === undefined && params === undefined) {
      return res.status(400).json({ error: 'At least one field to update is required' });
    }

    let query = 'UPDATE requests SET updated_at = CURRENT_TIMESTAMP';
    const values: any[] = [];
    let paramCount = 1;

    if (name) {
      query += `, name = $${paramCount}`;
      values.push(name);
      paramCount++;
    }

    if (method) {
      query += `, method = $${paramCount}`;
      values.push(method.toUpperCase());
      paramCount++;
    }

    if (url) {
      query += `, url = $${paramCount}`;
      values.push(url);
      paramCount++;
    }

    if (headers !== undefined) {
      query += `, headers = $${paramCount}`;
      values.push(headers);
      paramCount++;
    }

    if (body !== undefined) {
      query += `, body = $${paramCount}`;
      values.push(body);
      paramCount++;
    }

    if (params !== undefined) {
      query += `, params = $${paramCount}`;
      values.push(params);
      paramCount++;
    }

    query += ` WHERE id = $${paramCount} AND collection_id IN (
      SELECT id FROM collections WHERE workspace_id = $${paramCount + 1}
    ) RETURNING *`;
    values.push(id, workspaceId);

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    res.status(200).json({
      message: 'Request updated successfully',
      request: result.rows[0]
    });
  } catch (error) {
    console.error('Update request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE request
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const workspaceId = req.user!.workspace_id;
    
    const result = await pool.query(
      `DELETE FROM requests 
       WHERE id = $1 AND collection_id IN (
         SELECT id FROM collections WHERE workspace_id = $2
       ) RETURNING *`,
      [id, workspaceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    res.status(200).json({
      message: 'Request deleted successfully',
      request: result.rows[0]
    });
  } catch (error) {
    console.error('Delete request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 