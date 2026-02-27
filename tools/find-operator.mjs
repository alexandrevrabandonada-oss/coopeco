import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function getOperator() {
    const { data: profile, error } = await supabase.from('profiles').select('user_id').eq('role', 'operator').limit(1).single();
    if (error) {
        console.error('Erro ao buscar operador:', error.message);
        process.exit(1);
    }
    console.log(profile.user_id);
}

getOperator();
