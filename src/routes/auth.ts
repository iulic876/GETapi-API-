import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';

// Debug log to check connection string
console.log('Database URL:', process.env.DATABASE_URL);

const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Start a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if user exists
      const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existingUser.rows.length > 0) {
        return res.status(409).json({ 
          error: 'User already exists',
          message: `Email ${email} is already registered. Please use a different email or login.`
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const userResult = await client.query(
        'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name',
        [email, hashedPassword, name]
      );
      
      const user = userResult.rows[0];
      const workspaceName = `${name}'s Teams`;

      // Create workspace for the user
      const workspaceResult = await client.query(
        'INSERT INTO workspaces (name, owner_id) VALUES ($1, $2) RETURNING id, name',
        [workspaceName, user.id]
      );

      await client.query('COMMIT');
      
      const token = jwt.sign(
        { id: user.id, email: user.email, workspace_id: workspaceResult.rows[0].id },
        process.env.JWT_SECRET!,
        { expiresIn: '1h' }
      );

      res.status(201).json({
        message: 'User registered successfully',
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        },
        workspace: {
          id: workspaceResult.rows[0].id,
          name: workspaceResult.rows[0].name
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Registration error:', error);
    // Handle specific database errors
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ 
        error: 'User already exists',
        message: 'This email is already registered. Please use a different email or login.'
      });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await pool.query(
      `SELECT u.*, w.id as workspace_id, w.name as workspace_name 
       FROM users u 
       LEFT JOIN workspaces w ON w.owner_id = u.id 
       WHERE u.email = $1`,
      [email]
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { id: user.id, email: user.email, workspace_id: user.workspace_id },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      workspace: {
        id: user.workspace_id,
        name: user.workspace_name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user info
router.get('/me/:userId', async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    
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
    const responseData = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      workspace: {
        id: user.workspace_id,
        name: user.workspace_name
      }
    };

    console.log('GET /me response:', responseData);

    res.status(200).json(responseData);
  } catch (error) {
    console.error('Fetch user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 