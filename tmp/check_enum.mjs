import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = new pg.Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();
        const res = await client.query(`
      SELECT e.enumlabel
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid  
      JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace 
      WHERE t.typname = 'pickup_request_status'
    `);
        console.log('ENUM VALUES:', res.rows.map(r => r.enumlabel).join(', '));
    } catch (err) {
        console.error('ERROR:', err.message);
    } finally {
        await client.end();
    }
}

run();
