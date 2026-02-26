import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('ERRO: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados no .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runSeed() {
    console.log('--- ECO SEED START ---');

    try {
        // We'll use the supabase-js client to perform the inserts as defined in the SQL
        // Since we can't easily run a raw .sql file via standard supabase-js without an RPC,
        // we will implement the logic here directly or ensure the RPC is available.

        // Neighborhoods
        const neighborhoods = [
            { slug: 'centro', name: 'CENTRO' },
            { slug: 'vincualdo', name: 'VINCUALDO' },
            { slug: 'industrial', 'name': 'ZONA INDUSTRIAL' },
            { slug: 'porto', name: 'PORTO SECO' }
        ];

        for (const n of neighborhoods) {
            const { error } = await supabase.from('neighborhoods').upsert(n, { onConflict: 'slug' });
            if (error) console.warn(`Falha ao inserir bairro ${n.slug}:`, error.message);
            else console.log(`Bairro ${n.slug} OK`);
        }

        // Partners
        const partners = [
            { slug: 'recicla-ja', name: 'RECICLA JÁ', kind: 'collector', description: 'Centro de triagem de alta performance.' },
            { slug: 'eco-vidros', name: 'ECO VIDROS', kind: 'recycler', description: 'Especializada em garrafas e vidros planos.' },
            { slug: 'cafe-solidario', name: 'CAFÉ SOLIDÁRIO', kind: 'sponsor', description: 'Apoia a coleta local com pontos de fidelidade.' }
        ];

        for (const p of partners) {
            const { error } = await supabase.from('partners').upsert(p, { onConflict: 'slug' });
            if (error) console.warn(`Falha ao inserir parceiro ${p.slug}:`, error.message);
            else console.log(`Parceiro ${p.slug} OK`);
        }

        console.log('--- ECO SEED COMPLETE ---');
    } catch (err) {
        console.error('ERRO FATAL NO SEED:', err);
        process.exit(1);
    }
}

runSeed();
