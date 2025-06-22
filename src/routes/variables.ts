import { Router, Request, Response } from 'express';
import pool from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   name: Variables
 *   description: Workspace variables management
 */

/**
 * @swagger
 * /api/variables:
 *   get:
 *     summary: Get all variables for the user's workspace
 *     tags: [Variables]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: scope
 *         schema:
 *           type: string
 *         description: Filter by variable scope
 *     responses:
 *       200:
 *         description: List of variables
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { scope } = req.query;
    const workspaceId = req.user!.workspace_id;
    
    let query = `
      SELECT id, variable_key, value, scope, workspace_id, created_at, updated_at
      FROM variables
      WHERE workspace_id = $1
    `;
    const values: any[] = [workspaceId];
    let paramCount = 2;

    if (scope) {
      query += ` AND scope = $${paramCount}`;
      values.push(scope);
    }

    const result = await pool.query(query, values);
    res.status(200).json({
      variables: result.rows
    });
  } catch (error) {
    console.error('Get variables error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/variables:
 *   post:
 *     summary: Create a new variable
 *     tags: [Variables]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - key
 *               - value
 *             properties:
 *               key:
 *                 type: string
 *               value:
 *                 type: string
 *               scope:
 *                 type: string
 *                 default: workspace
 *     responses:
 *       201:
 *         description: Variable created
 *       400:
 *         description: Key and value are required
 *       409:
 *         description: Variable already exists
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { key, value, scope = 'workspace' } = req.body;
    const workspaceId = req.user!.workspace_id;

    if (!key || !value) {
      return res.status(400).json({ error: 'Key and value are required' });
    }

    const result = await pool.query(
      `INSERT INTO variables (variable_key, value, scope, workspace_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [key, value, scope, workspaceId]
    );

    res.status(201).json({
      message: 'Variable created successfully',
      variable: result.rows[0]
    });
  } catch (error: any) {
    console.error('Create variable error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ 
        error: 'Variable already exists',
        message: 'A variable with this key already exists in this workspace and scope'
      });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/variables/{id}:
 *   put:
 *     summary: Update a variable
 *     tags: [Variables]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Variable ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               key:
 *                 type: string
 *               value:
 *                 type: string
 *               scope:
 *                 type: string
 *     responses:
 *       200:
 *         description: Variable updated
 *       400:
 *         description: At least one field to update is required
 *       404:
 *         description: Variable not found
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { key, value, scope } = req.body;
    const workspaceId = req.user!.workspace_id;

    if (!key && !value && !scope) {
      return res.status(400).json({ error: 'At least one field to update is required' });
    }

    let query = 'UPDATE variables SET updated_at = CURRENT_TIMESTAMP';
    const values: any[] = [];
    let paramCount = 1;

    if (key) {
      query += `, variable_key = $${paramCount}`;
      values.push(key);
      paramCount++;
    }

    if (value) {
      query += `, value = $${paramCount}`;
      values.push(value);
      paramCount++;
    }

    if (scope) {
      query += `, scope = $${paramCount}`;
      values.push(scope);
      paramCount++;
    }

    query += ` WHERE id = $${paramCount} AND workspace_id = $${paramCount + 1} RETURNING *`;
    values.push(id, workspaceId);

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Variable not found' });
    }

    res.status(200).json({
      message: 'Variable updated successfully',
      variable: result.rows[0]
    });
  } catch (error) {
    console.error('Update variable error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/variables/{id}:
 *   delete:
 *     summary: Delete a variable
 *     tags: [Variables]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Variable ID
 *     responses:
 *       200:
 *         description: Variable deleted
 *       404:
 *         description: Variable not found
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const workspaceId = req.user!.workspace_id;
    
    const result = await pool.query(
      'DELETE FROM variables WHERE id = $1 AND workspace_id = $2 RETURNING *',
      [id, workspaceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Variable not found' });
    }

    res.status(200).json({
      message: 'Variable deleted successfully',
      variable: result.rows[0]
    });
  } catch (error) {
    console.error('Delete variable error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;