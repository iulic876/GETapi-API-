import { Pool } from 'pg';
const pool = new Pool({
    connectionString: 'postgresql://APIget_owner:npg_lz6VTuZ1GKfd@ep-black-feather-a8ojflwt-pooler.eastus2.azure.neon.tech/APIget?sslmode=require'
});
export default pool;
