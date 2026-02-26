import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const cutoffArg = process.argv[2] || process.env.ECO_DRYRUN_CUTOFF_DAYS || '30';
const cutoffDays = Number(cutoffArg);

const TEST_OPERATOR_EMAIL = 'eco.operator.test@local';
const TEST_PW = 'EcoTest123!';

if (!supabaseUrl || !anonKey || !serviceKey) {
  console.error('ERRO: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY ou SUPABASE_SERVICE_ROLE_KEY faltando.');
  process.exit(1);
}

if (!Number.isInteger(cutoffDays) || cutoffDays < 0) {
  console.error(`ERRO: cutoff_days invalido (${cutoffArg}). Use inteiro >= 0.`);
  process.exit(1);
}

const serviceClient = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function ensureOperatorUser() {
  const { data: listed, error: listError } = await serviceClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw new Error(`Falha listUsers: ${listError.message}`);

  let operatorUser = listed.users.find((user) => user.email === TEST_OPERATOR_EMAIL);
  if (!operatorUser) {
    const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
      email: TEST_OPERATOR_EMAIL,
      password: TEST_PW,
      email_confirm: true,
    });
    if (createError || !created.user) throw new Error(`Falha ao criar operador de teste: ${createError?.message ?? 'sem detalhes'}`);
    operatorUser = created.user;
  } else {
    const { error: updateError } = await serviceClient.auth.admin.updateUserById(operatorUser.id, {
      password: TEST_PW,
    });
    if (updateError) throw new Error(`Falha ao resetar senha do operador: ${updateError.message}`);
  }

  const { data: centro, error: centroError } = await serviceClient
    .from('neighborhoods')
    .select('id')
    .eq('slug', 'centro')
    .single();
  if (centroError || !centro) throw new Error(`Bairro centro nao encontrado: ${centroError?.message ?? 'sem detalhes'}`);

  const { error: profileError } = await serviceClient.from('profiles').upsert(
    {
      user_id: operatorUser.id,
      display_name: 'OPERADOR TESTE',
      neighborhood_id: centro.id,
      role: 'operator',
    },
    { onConflict: 'user_id' },
  );
  if (profileError) throw new Error(`Falha no perfil do operador: ${profileError.message}`);

  return operatorUser;
}

async function run() {
  console.log('--- ECO DRYRUN CLEANUP START ---');

  try {
    const operatorUser = await ensureOperatorUser();

    const operatorClient = createClient(supabaseUrl, anonKey);
    const { error: loginError } = await operatorClient.auth.signInWithPassword({
      email: operatorUser.email || TEST_OPERATOR_EMAIL,
      password: TEST_PW,
    });
    if (loginError) throw new Error(`Falha no login do operador: ${loginError.message}`);

    const { data: result, error: rpcError } = await operatorClient.rpc('rpc_cleanup_dryrun', {
      cutoff_days: cutoffDays,
    });
    if (rpcError) throw new Error(`Falha no rpc_cleanup_dryrun: ${rpcError.message}`);

    console.log(`[PASS] rpc_cleanup_dryrun executada com cutoff_days=${cutoffDays}`);
    console.log('Resumo:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('ERRO NO CLEANUP:', error.message);
    process.exit(1);
  }
}

run();
