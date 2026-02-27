import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugMigration() {
    const sql = fs.readFileSync('supabase/migrations/20260226130000_eco_gamification.sql', 'utf8');

    // We can't run arbitrary SQL via supabase-js easily unless we have an RPC
    // But we might have 'exec_sql' or similar if it was created in previous phases.
    // Let's check if 'rpc_apply_migration' exists or similar in the codebase.
}

async function checkTables() {
    const { data, error } = await supabase.from('gamification_levels').select('*');
    if (error) {
        console.error('Erro ao ler gamification_levels:', error.message);
    } else {
        console.log('Tabela gamification_levels existe.');
    }
}

checkTables();
