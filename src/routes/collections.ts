import { Router, Request, Response } from 'express';
import pool from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { runCollection } from '../services/collectionRunner.js';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   name: Collections
 *   description: Collections management
 */

/**
 * @swagger
 * /api/collections:
 *   get:
 *     summary: Get all collections for the user's workspace
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of collections
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 collections:
 *                   type: array
 *                   items:
 *                     type: object
 */
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

/**
 * @swagger
 * /api/collections/{id}:
 *   get:
 *     summary: Get a single collection with its requests
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Collection ID
 *     responses:
 *       200:
 *         description: Collection and its requests
 *       404:
 *         description: Collection not found
 */
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

/**
 * @swagger
 * /api/collections:
 *   post:
 *     summary: Create a new collection
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Collection created
 *       400:
 *         description: Collection name is required
 */
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

/**
 * @swagger
 * /api/collections/{id}:
 *   put:
 *     summary: Update a collection
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Collection ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Collection updated
 *       400:
 *         description: At least one field to update is required
 *       404:
 *         description: Collection not found
 */
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

/**
 * @swagger
 * /api/collections/{id}:
 *   delete:
 *     summary: Delete a collection
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Collection ID
 *     responses:
 *       200:
 *         description: Collection deleted
 *       404:
 *         description: Collection not found
 */
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

/**
 * @swagger
 * /api/collections/{collectionId}/run:
 *   post:
 *     summary: Run a collection
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: collectionId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the collection to run
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - executionMode
 *               - environment
 *               - variables
 *             properties:
 *               executionMode:
 *                 type: string
 *                 enum: [sequential, parallel]
 *               delayBetweenRequests:
 *                 type: integer
 *                 description: Delay in ms between requests for sequential mode
 *               environment:
 *                 type: string
 *                 enum: [development, staging, production]
 *               variables:
 *                 type: object
 *                 additionalProperties: true
 *           example:
 *             executionMode: "sequential"
 *             delayBetweenRequests: 1000
 *             environment: "development"
 *             variables:
 *               baseUrl: "http://localhost:3001"
 *               authToken: "your_token_here"
 *     responses:
 *       200:
 *         description: Collection run results
 *       400:
 *         description: Invalid request body
 *       404:
 *         description: Collection not found
 */
router.post('/:collectionId/run', async (req: Request, res: Response) => {
  try {
    const { collectionId } = req.params;
    const workspaceId = req.user!.workspace_id;
    const { executionMode, delayBetweenRequests, environment, variables } = req.body;

    if (!executionMode || !environment || !variables) {
      return res.status(400).json({ error: 'executionMode, environment, and variables are required' });
    }

    // 1. Fetch collection and its requests
    const collectionResult = await pool.query(
      'SELECT id FROM collections WHERE id = $1 AND workspace_id = $2',
      [collectionId, workspaceId]
    );

    if (collectionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Collection not found' });
    }
    
    const requestsResult = await pool.query(
      'SELECT id, name, method, url, headers, body, params FROM requests WHERE collection_id = $1 ORDER BY created_at ASC',
      [collectionId]
    );

    const requests = requestsResult.rows;

    // 2. Execute the collection run
    const runResults = await runCollection(requests, {
      executionMode,
      delayBetweenRequests,
      environment,
      variables,
    });

    res.status(200).json(runResults);

  } catch (error) {
    console.error('Collection run error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 