import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    console.log('--- CHECKING VIEWS ---');
    const { data: v1, error: e1 } = await supabase.from('v_rank_neighborhood_30d').select('*').limit(1);
    if (e1) console.error('v_rank_neighborhood_30d ERROR:', e1.message);
    else console.log('v_rank_neighborhood_30d OK:', v1);

    const { data: v2, error: e2 } = await supabase.from('v_transparency_neighborhood_month').select('*').limit(1);
    if (e2) console.error('v_transparency_neighborhood_month ERROR:', e2.message);
    else console.log('v_transparency_neighborhood_month OK:', v2);
}
check();
