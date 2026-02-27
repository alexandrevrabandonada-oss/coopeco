import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkErr() {
    const { data: { session } } = await supabase.auth.getSession();
    // We don't have a direct SQL runner here. 
    // I'll try to check if the columns exist or not.
    const { data, error } = await supabase.from('impact_events').select('user_id').limit(1);
    if (error) {
        console.error('user_id column error:', error.message);
    } else {
        console.log('user_id column exists.');
    }
}

checkErr();
