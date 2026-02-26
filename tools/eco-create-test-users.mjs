import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('ERRO: Variáveis de ambiente faltando.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const TEST_USERS = [
    { email: 'eco.resident.test@local', role: 'resident', name: 'RESIDENTE TESTE' },
    { email: 'eco.cooperado.test@local', role: 'cooperado', name: 'COOPERADO TESTE' },
    { email: 'eco.operator.test@local', role: 'operator', name: 'OPERADOR TESTE' }
];

const TEST_PW = 'EcoTest123!';

async function createTestUsers() {
    console.log('--- CREATE TEST USERS START ---');

    for (const user of TEST_USERS) {
        const password = TEST_PW;

        // 1. Create or recover auth user
        const { data: { user: authUser }, error: authError } = await supabase.auth.admin.createUser({
            email: user.email,
            password: password,
            email_confirm: true
        });

        if (authError) {
            const { data: listed, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
            if (listError) {
                console.error(`Erro ao listar usuários ao tratar ${user.email}:`, listError.message);
                continue;
            }

            const existing = listed.users.find((listedUser) => listedUser.email === user.email);
            if (existing) {
                console.log(`Usuário ${user.email} já existe. Mantendo auth e garantindo perfil.`);
                await setupProfile(existing.id, user);
                continue;
            }

            console.error(`Erro ao criar ${user.email}:`, authError.message);
        } else if (authUser) {
            console.log(`USUÁRIO CRIADO: ${user.email}`);
            await setupProfile(authUser.id, user);
        }
    }
    console.log('--- CREATE TEST USERS COMPLETE ---');
}

async function setupProfile(userId, config) {
    // Get default neighborhood (Centro)
    const { data: neighborhood } = await supabase.from('neighborhoods').select('id').eq('slug', 'centro').single();

    // Create/Update Profile
    const { error: profileError } = await supabase.from('profiles').upsert({
        user_id: userId,
        display_name: config.name,
        neighborhood_id: neighborhood?.id,
        role: config.role
    }, { onConflict: 'user_id' });

    if (profileError) {
        console.error(`Erro no perfil de ${config.email}:`, profileError.message);
    } else {
        console.log(`PERFIL CONFIGURADO: ${config.email} (${config.role})`);
    }
}

try {
    await createTestUsers();
} catch (err) {
    console.error('ERRO FATAL NO CREATE TEST USERS:', err);
    process.exit(1);
}
