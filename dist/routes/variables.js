import { Router } from 'express';
import pool from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
const router = Router();
// Apply auth middleware to all routes
router.use(authMiddleware);
// GET variables for authenticated user's workspace
router.get('/', async (req, res) => {
    try {
        const { scope } = req.query;
        const workspaceId = req.user.workspace_id;
        let query = `
      SELECT id, variable_key, value, scope, workspace_id, created_at, updated_at
      FROM variables
      WHERE workspace_id = $1
    `;
        const values = [workspaceId];
        let paramCount = 2;
        if (scope) {
            query += ` AND scope = $${paramCount}`;
            values.push(scope);
        }
        const result = await pool.query(query, values);
        res.status(200).json({
            variables: result.rows
        });
    }
    catch (error) {
        console.error('Get variables error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST create variable in authenticated user's workspace
router.post('/', async (req, res) => {
    try {
        const { key, value, scope = 'workspace' } = req.body;
        const workspaceId = req.user.workspace_id;
        if (!key || !value) {
            return res.status(400).json({ error: 'Key and value are required' });
        }
        const result = await pool.query(`INSERT INTO variables (variable_key, value, scope, workspace_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`, [key, value, scope, workspaceId]);
        res.status(201).json({
            message: 'Variable created successfully',
            variable: result.rows[0]
        });
    }
    catch (error) {
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
// PUT update variable (only if it belongs to user's workspace)
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { key, value, scope } = req.body;
        const workspaceId = req.user.workspace_id;
        if (!key && !value && !scope) {
            return res.status(400).json({ error: 'At least one field to update is required' });
        }
        let query = 'UPDATE variables SET updated_at = CURRENT_TIMESTAMP';
        const values = [];
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
    }
    catch (error) {
        console.error('Update variable error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// DELETE variable (only if it belongs to user's workspace)
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const workspaceId = req.user.workspace_id;
        const result = await pool.query('DELETE FROM variables WHERE id = $1 AND workspace_id = $2 RETURNING *', [id, workspaceId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Variable not found' });
        }
        res.status(200).json({
            message: 'Variable deleted successfully',
            variable: result.rows[0]
        });
    }
    catch (error) {
        console.error('Delete variable error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
export default router;
