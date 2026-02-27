import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const client = new pg.Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();

        const sql = fs.readFileSync('supabase/migrations/20260226235000_eco_ops_alerts_v0.sql', 'utf8');
        await client.query(sql);
        console.log('FULL MIGRATION SUCCESS');

    } catch (err) {
        console.error('ERROR:', err.message);
        if (err.hint) console.error('HINT:', err.hint);
        if (err.where) console.error('WHERE:', err.where);
    } finally {
        await client.end();
    }
}

run();
