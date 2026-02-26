import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceKey) {
  console.error('ERRO: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY ou SUPABASE_SERVICE_ROLE_KEY faltando.');
  process.exit(1);
}

const serviceClient = createClient(supabaseUrl, serviceKey);
const TEST_PW = 'EcoTest123!';
const TEST_USERS = [
  { email: 'eco.resident.test@local', role: 'resident', name: 'RESIDENTE TESTE' },
  { email: 'eco.cooperado.test@local', role: 'cooperado', name: 'COOPERADO TESTE' },
  { email: 'eco.operator.test@local', role: 'operator', name: 'OPERADOR TESTE' },
];

const makeReceiptCode = (prefix) =>
  `${prefix}${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

function toDateISO(date) {
  return date.toISOString().split('T')[0];
}

async function ensureTestUsers() {
  const { data: usersData, error: usersError } = await serviceClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) throw new Error(`Falha listUsers: ${usersError.message}`);

  const byEmail = new Map(usersData.users.map((user) => [user.email, user]));

  const { data: centro, error: centroError } = await serviceClient
    .from('neighborhoods')
    .select('id')
    .eq('slug', 'centro')
    .single();
  if (centroError || !centro) throw new Error(`Bairro centro nao encontrado: ${centroError?.message ?? 'sem detalhes'}`);

  const result = {};
  for (const person of TEST_USERS) {
    let authUser = byEmail.get(person.email);
    if (!authUser) {
      const { data, error } = await serviceClient.auth.admin.createUser({
        email: person.email,
        password: TEST_PW,
        email_confirm: true,
      });
      if (error || !data.user) throw new Error(`Falha ao criar ${person.email}: ${error?.message ?? 'sem detalhes'}`);
      authUser = data.user;
    } else {
      const { error } = await serviceClient.auth.admin.updateUserById(authUser.id, { password: TEST_PW });
      if (error) throw new Error(`Falha ao atualizar senha ${person.email}: ${error.message}`);
    }

    const { error: profileError } = await serviceClient.from('profiles').upsert(
      {
        user_id: authUser.id,
        display_name: person.name,
        neighborhood_id: centro.id,
        role: person.role,
      },
      { onConflict: 'user_id' },
    );
    if (profileError) throw new Error(`Falha ao upsert profile ${person.email}: ${profileError.message}`);

    result[person.role] = authUser;
  }

  return {
    resident: result.resident,
    cooperado: result.cooperado,
    operator: result.operator,
    centroId: centro.id,
  };
}

async function login(email) {
  const client = createClient(supabaseUrl, anonKey);
  const { error } = await client.auth.signInWithPassword({ email, password: TEST_PW });
  if (error) throw new Error(`Falha no login (${email}): ${error.message}`);
  return client;
}

async function createReceiptFlow({ residentId, cooperadoId, centroId, iteration }) {
  const { data: request, error: requestError } = await serviceClient
    .from('pickup_requests')
    .insert({
      created_by: residentId,
      neighborhood_id: centroId,
      status: 'collected',
      notes: `dryrun-${iteration}`,
    })
    .select('id')
    .single();
  if (requestError || !request) throw new Error(`Falha ao criar request dryrun: ${requestError?.message ?? 'sem detalhes'}`);

  const { error: privateError } = await serviceClient.from('pickup_request_private').upsert(
    {
      request_id: request.id,
      address_full: `Endereco dryrun ${iteration}`,
      contact_phone: '000000000',
    },
    { onConflict: 'request_id' },
  );
  if (privateError) throw new Error(`Falha ao criar private dryrun: ${privateError.message}`);

  const { error: assignmentError } = await serviceClient.from('pickup_assignments').upsert(
    {
      request_id: request.id,
      cooperado_id: cooperadoId,
    },
    { onConflict: 'request_id' },
  );
  if (assignmentError) throw new Error(`Falha ao criar assignment dryrun: ${assignmentError.message}`);

  const { data: receipt, error: receiptError } = await serviceClient
    .from('receipts')
    .insert({
      request_id: request.id,
      cooperado_id: cooperadoId,
      receipt_code: makeReceiptCode('DRY'),
      items: [
        { material: 'plastic', unit: 'bag_m', quantity: 5 + iteration },
        { material: 'paper', unit: 'bag_p', quantity: 4 + iteration },
      ],
    })
    .select('id')
    .single();
  if (receiptError || !receipt) throw new Error(`Falha ao criar receipt dryrun: ${receiptError?.message ?? 'sem detalhes'}`);

  const { error: markError } = await serviceClient.from('receipts_test_marks').upsert(
    {
      receipt_id: receipt.id,
      mark: 'DRYRUN',
    },
    { onConflict: 'receipt_id' },
  );
  if (markError) throw new Error(`Falha ao marcar receipt dryrun: ${markError.message}`);
}

async function run() {
  console.log('--- ECO PAYOUT DRYRUN START ---');
  const results = { pass: 0, fail: 0 };

  const test = (name, condition, detail) => {
    if (condition) {
      console.log(`[PASS] ${name}`);
      results.pass += 1;
    } else {
      console.log(`[FAIL] ${name}`);
      if (detail) console.log(`       -> ${detail}`);
      results.fail += 1;
    }
  };

  try {
    const { resident, cooperado, operator, centroId } = await ensureTestUsers();
    const operatorClient = await login(operator.email);
    const cooperadoClient = await login(cooperado.email);
    const residentClient = await login(resident.email);

    const periodStartDate = new Date();
    periodStartDate.setDate(periodStartDate.getDate() - 6);
    const periodEndDate = new Date();
    const periodStart = toDateISO(periodStartDate);
    const periodEnd = toDateISO(periodEndDate);

    const { data: periodId, error: createPeriodError } = await operatorClient.rpc('rpc_create_payout_period', {
      period_start: periodStart,
      period_end: periodEnd,
    });
    test('Cria periodo (ultimos 7 dias)', !createPeriodError && !!periodId, createPeriodError?.message);
    if (!periodId) {
      throw new Error('Nao foi possivel criar periodo dryrun');
    }

    for (let i = 1; i <= 3; i += 1) {
      await createReceiptFlow({
        residentId: resident.id,
        cooperadoId: cooperado.id,
        centroId,
        iteration: i,
      });
    }
    test('Cria 3 receipts para cooperado', true);

    await new Promise((resolve) => setTimeout(resolve, 1200));

    const { error: closeError } = await operatorClient.rpc('rpc_close_payout_period', { period_id: periodId });
    test('Fecha periodo (open -> closed)', !closeError, closeError?.message);

    const { error: adjError } = await operatorClient.rpc('rpc_add_adjustment', {
      cooperado_id: cooperado.id,
      period_id: periodId,
      amount_cents: -100,
      reason: 'Dryrun ajuste auditavel',
    });
    test('Cria ajuste auditavel (-100)', !adjError, adjError?.message);

    const { error: paidError } = await operatorClient.rpc('rpc_mark_payout_paid', {
      period_id: periodId,
      payout_reference: 'DRYRUN',
    });
    test('Marca periodo como pago (closed -> paid)', !paidError, paidError?.message);

    const startIso = `${periodStart}T00:00:00.000Z`;
    const endIso = `${periodEnd}T23:59:59.999Z`;
    const [{ data: ledgerRows }, { data: adjustmentRows }, { data: payoutRows }] = await Promise.all([
      serviceClient
        .from('coop_earnings_ledger')
        .select('total_cents')
        .gte('created_at', startIso)
        .lte('created_at', endIso),
      serviceClient
        .from('coop_earning_adjustments')
        .select('amount_cents')
        .eq('period_id', periodId),
      serviceClient
        .from('coop_payouts')
        .select('total_cents, status, payout_reference')
        .eq('period_id', periodId),
    ]);

    const ledgerTotal = (ledgerRows || []).reduce((sum, row) => sum + row.total_cents, 0);
    const adjustmentTotal = (adjustmentRows || []).reduce((sum, row) => sum + row.amount_cents, 0);
    const payoutTotal = (payoutRows || []).reduce((sum, row) => sum + row.total_cents, 0);
    const diff = ledgerTotal + adjustmentTotal - payoutTotal;
    test(
      'Reconciliacao fecha em zero',
      diff === 0,
      `ledger=${ledgerTotal} adjustments=${adjustmentTotal} payouts=${payoutTotal} diff=${diff}`,
    );

    const { data: coopPayouts, error: coopPayoutError } = await cooperadoClient
      .from('coop_payouts')
      .select('cooperado_id, period_id, status, payout_reference')
      .eq('period_id', periodId);
    test(
      'Cooperado ve apenas o proprio payout',
      !coopPayoutError && (coopPayouts || []).every((row) => row.cooperado_id === cooperado.id),
      coopPayoutError?.message ?? `rows=${coopPayouts?.length ?? 0}`,
    );

    const { data: coopAdjustments, error: coopAdjError } = await cooperadoClient
      .from('coop_earning_adjustments')
      .select('cooperado_id, period_id')
      .eq('period_id', periodId);
    test(
      'Cooperado ve apenas os proprios ajustes',
      !coopAdjError && (coopAdjustments || []).every((row) => row.cooperado_id === cooperado.id),
      coopAdjError?.message ?? `rows=${coopAdjustments?.length ?? 0}`,
    );

    const { data: residentLedger } = await residentClient.from('coop_earnings_ledger').select('id').limit(1);
    test('Resident nao acessa ledger', !residentLedger || residentLedger.length === 0);

    const { data: residentPayouts } = await residentClient
      .from('coop_payouts')
      .select('id')
      .eq('period_id', periodId);
    test('Resident nao acessa payouts', !residentPayouts || residentPayouts.length === 0);

    const { data: residentAdjustments } = await residentClient
      .from('coop_earning_adjustments')
      .select('id')
      .eq('period_id', periodId);
    test('Resident nao acessa ajustes', !residentAdjustments || residentAdjustments.length === 0);

    const paidOk = (payoutRows || []).every((row) => row.status === 'paid' && row.payout_reference === 'DRYRUN');
    test('Todos payouts do periodo estao pagos com referencia DRYRUN', paidOk);

    console.log(`\nRESUMO DRYRUN: ${results.pass} PASS / ${results.fail} FAIL`);
    if (results.fail > 0) process.exit(1);
  } catch (error) {
    console.error('ERRO NO PAYOUT DRYRUN:', error);
    process.exit(1);
  }
}

run();
