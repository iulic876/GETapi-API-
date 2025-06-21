import pool from './config/database.js';

const initDatabase = async () => {
  try {
    console.log('🏗️  Verifying and building tables if they do not exist...');
    
    // Create users table
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Create workspaces table
    const createWorkspacesTable = `
      CREATE TABLE IF NOT EXISTS workspaces (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Create workspace members table
    const createWorkspaceMembersTable = `
      CREATE TABLE IF NOT EXISTS workspace_members (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50) DEFAULT 'member',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(workspace_id, user_id)
      );
    `;
    
    // Create collections table
    const createCollectionsTable = `
      CREATE TABLE IF NOT EXISTS collections (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
        created_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Create requests table
    const createRequestsTable = `
      CREATE TABLE IF NOT EXISTS requests (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        method VARCHAR(10) NOT NULL DEFAULT 'GET',
        url TEXT NOT NULL,
        headers JSONB DEFAULT '{}',
        body JSONB DEFAULT '{}',
        params JSONB DEFAULT '{}',
        collection_id INTEGER NOT NULL,
        created_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_collection
          FOREIGN KEY(collection_id) 
          REFERENCES collections(id)
          ON DELETE CASCADE
      );
    `;

    // Create variables table
    const createVariablesTable = `
      CREATE TABLE IF NOT EXISTS variables (
        id SERIAL PRIMARY KEY,
        variable_key VARCHAR(255) NOT NULL,
        value TEXT NOT NULL,
        scope VARCHAR(50) NOT NULL DEFAULT 'workspace',
        workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(variable_key, workspace_id, scope)
      );
    `;

    await pool.query(createUsersTable);
    await pool.query(createWorkspacesTable);
    await pool.query(createWorkspaceMembersTable);
    await pool.query(createCollectionsTable);
    await pool.query(createRequestsTable);
    await pool.query(createVariablesTable);
    console.log('✅ Database schema is up to date.');
  } catch (error) {
    console.error('❌ Table initialization failed:', error);
    process.exit(1);
  }
};

export default initDatabase; 