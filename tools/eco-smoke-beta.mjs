import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fetchWithBypass, getDeploymentProtectionHint, maskBypassSecret } from './_fetchWithBypass.mjs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const smokeBaseUrlEnv = process.env.ECO_SMOKE_BASE_URL;
const isRemoteSmoke = Boolean(smokeBaseUrlEnv);
const smokePort = Number(process.env.ECO_SMOKE_PORT || 4317);
const shouldCleanup = (process.env.ECO_SMOKE_CLEANUP || '').toLowerCase() === 'true';
const stagingPass = process.env.ECO_SMOKE_STAGING_PASS || process.env.ECO_STAGING_PASS || '';
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const TEST_PW = 'EcoTest123!';
const TEST_EMAILS = {
  resident: 'eco.resident.test@local',
  cooperado: 'eco.cooperado.test@local',
  operator: 'eco.operator.test@local',
};

if (!supabaseUrl || !anonKey) {
  console.error('ERRO: NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY faltando.');
  process.exit(1);
}

if (!serviceKey) {
  console.error('ERRO: SUPABASE_SERVICE_ROLE_KEY faltando (necessario para bootstrap de usuarios de teste).');
  process.exit(1);
}

if (!Number.isInteger(smokePort) || smokePort < 1 || smokePort > 65535) {
  console.error(`ERRO: ECO_SMOKE_PORT invalido (${process.env.ECO_SMOKE_PORT}).`);
  process.exit(1);
}

const serviceClient = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function guessCause(error) {
  const message = String(error?.message || error || '');
  if (/permission|forbidden|policy|rls|42501|403/i.test(message)) {
    return 'Provavel bloqueio de RLS/policy para o papel usado nesta etapa.';
  }
  if (/401|token|jwt|auth|session/i.test(message)) {
    return 'Provavel falha de autenticacao dos usuarios de teste.';
  }
  if (/ECONNREFUSED|fetch failed|ENOTFOUND|timeout/i.test(message)) {
    return 'Provavel indisponibilidade do servidor local ou URL de smoke invalida.';
  }
  if (/404|not found/i.test(message)) {
    return 'Provavel registro esperado nao foi criado na etapa anterior.';
  }
  return 'Verifique o erro detalhado e repita apenas a etapa com falha.';
}

function spawnCrossPlatform(command, args, options = {}) {
  if (process.platform !== 'win32') {
    return spawn(command, args, options);
  }

  const commandLine = [command, ...args]
    .map((part) => (/\s/.test(part) ? `"${part}"` : part))
    .join(' ');

  return spawn(commandLine, {
    ...options,
    shell: true,
  });
}

function runCommand(command, args, label, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnCrossPlatform(command, args, {
      stdio: 'inherit',
      env: { ...process.env, ...extraEnv },
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`${label} retornou exit code ${code}.`));
    });
  });
}

async function ensureBuildExists() {
  const buildIdPath = path.join(process.cwd(), '.next', 'BUILD_ID');
  try {
    await access(buildIdPath);
  } catch {
    await runCommand(npmCmd, ['run', 'build'], 'npm run build');
  }
}

async function waitForHttpReady(baseUrl, timeoutMs = 90_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetchWithBypass(`${baseUrl}/`, { method: 'GET' });
      if (response.status >= 200 && response.status < 500) {
        return;
      }
    } catch {
      // keep polling
    }
    await sleep(1000);
  }
  throw new Error(`Timeout aguardando servidor HTTP em ${baseUrl}.`);
}

async function stopServer(child) {
  if (!child || child.killed) return;
  if (process.platform === 'win32') {
    const killCmd = spawn('taskkill', ['/pid', String(child.pid), '/f', '/t'], { stdio: 'ignore' });
    await new Promise((resolve) => {
      killCmd.on('close', () => resolve());
      killCmd.on('error', () => resolve());
    });
    return;
  }

  child.kill('SIGTERM');
  await new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(), 4000);
    child.on('close', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

function makeReceiptCode(prefix) {
  return `${prefix}${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function nextWeekdayTimestamp(weekday, hour = 9, minute = 0) {
  const now = new Date();
  const candidate = new Date(now);
  const diff = (weekday - candidate.getDay() + 7) % 7;
  candidate.setDate(candidate.getDate() + diff);
  candidate.setHours(hour, minute, 0, 0);
  if (diff === 0 && candidate.getTime() <= now.getTime()) {
    candidate.setDate(candidate.getDate() + 7);
  }
  return candidate.toISOString();
}

function makeHeaders(extra = {}) {
  const headers = { ...extra };
  if (stagingPass) {
    headers['x-eco-gate'] = stagingPass;
    headers['x-eco-staging-pass'] = stagingPass;
  }
  return headers;
}

async function login(email) {
  const client = createClient(supabaseUrl, anonKey);
  const { data, error } = await client.auth.signInWithPassword({ email, password: TEST_PW });
  if (error || !data.session || !data.user) {
    throw new Error(`Falha no login de ${email}: ${error?.message ?? 'sem sessao'}`);
  }
  return {
    client,
    token: data.session.access_token,
    user: data.user,
  };
}

async function run() {
  console.log('--- ECO SMOKE BETA START ---');
  let serverChild = null;
  let baseUrl = smokeBaseUrlEnv || '';
  let stepNumber = 0;
  let passCount = 0;
  let failCount = 0;
  let requestId = '';
  let receiptId = '';
  let periodId = '';
  let neighborhoodId = '';
  let neighborhoodSlug = 'centro';

  const step = async (title, fn) => {
    stepNumber += 1;
    const label = `${stepNumber}. ${title}`;
    console.log(`\n[RUN] ${label}`);
    try {
      const value = await fn();
      passCount += 1;
      console.log(`[PASS] ${label}`);
      return value;
    } catch (error) {
      failCount += 1;
      const message = maskBypassSecret(error?.message || String(error));
      console.log(`[FAIL] ${label}`);
      console.log(`       -> ${message}`);
      console.log(`       -> Causa provavel: ${guessCause(error)}`);
      throw error;
    }
  };

  try {
    if (!isRemoteSmoke) {
      await step('Garantir DB aplicado (db:apply)', async () => {
        await runCommand(npmCmd, ['run', 'db:apply'], 'npm run db:apply');
      });
    } else {
      console.log('[INFO] ECO_SMOKE_BASE_URL detectado: skip de db:apply local no smoke remoto.');
    }

    await step('Garantir usuarios de teste (eco-create-test-users)', async () => {
      await runCommand('node', ['tools/eco-create-test-users.mjs'], 'node tools/eco-create-test-users.mjs');
    });

    const auth = await step('Login resident/cooperado/operator', async () => {
      const { data: usersData, error: usersError } = await serviceClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (usersError) throw new Error(`Falha ao listar usuarios: ${usersError.message}`);

      const residentAuth = usersData.users.find((user) => user.email === TEST_EMAILS.resident);
      const cooperadoAuth = usersData.users.find((user) => user.email === TEST_EMAILS.cooperado);
      const operatorAuth = usersData.users.find((user) => user.email === TEST_EMAILS.operator);
      if (!residentAuth || !cooperadoAuth || !operatorAuth) {
        throw new Error('Usuarios de teste nao encontrados apos create-test-users.');
      }

      await serviceClient.auth.admin.updateUserById(residentAuth.id, { password: TEST_PW });
      await serviceClient.auth.admin.updateUserById(cooperadoAuth.id, { password: TEST_PW });
      await serviceClient.auth.admin.updateUserById(operatorAuth.id, { password: TEST_PW });

      const [resident, cooperado, operator] = await Promise.all([
        login(TEST_EMAILS.resident),
        login(TEST_EMAILS.cooperado),
        login(TEST_EMAILS.operator),
      ]);

      return { resident, cooperado, operator };
    });

    await step('Reset guardrail diario do resident de teste', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await serviceClient
        .from('request_rate_limits')
        .delete()
        .eq('user_id', auth.resident.user.id)
        .eq('day', today);
      if (error) {
        throw new Error(`Falha ao resetar rate limit de teste: ${error.message}`);
      }
    });

    await step('Criar request resident (2 itens + private)', async () => {
      const { data: centro, error: centroError } = await auth.resident.client
        .from('neighborhoods')
        .select('id, slug')
        .eq('slug', 'centro')
        .single();
      if (centroError || !centro) {
        throw new Error(`Bairro centro nao encontrado: ${centroError?.message ?? 'sem detalhes'}`);
      }
      neighborhoodId = centro.id;
      neighborhoodSlug = centro.slug || 'centro';

      const { data: activeWindow } = await auth.resident.client
        .from('route_windows')
        .select('id, weekday, start_time')
        .eq('neighborhood_id', neighborhoodId)
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const startTime = String(activeWindow?.start_time || '09:00');
      const hour = Number(startTime.slice(0, 2));
      const minute = Number(startTime.slice(3, 5));

      const requestPayload = {
        created_by: auth.resident.user.id,
        neighborhood_id: neighborhoodId,
        route_window_id: activeWindow?.id ?? null,
        scheduled_for: activeWindow ? nextWeekdayTimestamp(activeWindow.weekday, hour, minute) : null,
        status: 'open',
        notes: 'DRYRUN BETA SMOKE',
      };
      const { data: request, error: requestError } = await auth.resident.client
        .from('pickup_requests')
        .insert(requestPayload)
        .select('id')
        .single();
      if (requestError || !request) {
        throw new Error(`Falha ao criar pickup_request: ${requestError?.message ?? 'sem detalhes'}`);
      }
      requestId = request.id;

      const itemsPayload = [
        { request_id: requestId, material: 'plastic', unit: 'bag_m', qty: 4 },
        { request_id: requestId, material: 'paper', unit: 'bag_p', qty: 3 },
      ];
      const { error: itemsError } = await auth.resident.client
        .from('pickup_request_items')
        .insert(itemsPayload);
      if (itemsError) {
        throw new Error(`Falha ao inserir itens: ${itemsError.message}`);
      }

      const { error: privateError } = await auth.resident.client.from('pickup_request_private').insert(
        {
          request_id: requestId,
          address_full: 'Endereco DRYRUN BETA',
          contact_phone: '000000000',
        },
      );
      if (privateError) throw new Error(`Falha ao inserir private: ${privateError.message}`);
    });

    await step('Cooperado aceita/processa coleta e gera recibo com 2 fotos', async () => {
      const { data: openRows, error: openError } = await auth.cooperado.client
        .from('pickup_requests')
        .select('id')
        .eq('status', 'open')
        .eq('id', requestId);
      if (openError) throw new Error(`Falha ao listar open requests: ${openError.message}`);
      if (!openRows || openRows.length === 0) throw new Error('Request nao apareceu na lista open do cooperado.');

      const { error: assignError } = await auth.cooperado.client.from('pickup_assignments').insert(
        {
          request_id: requestId,
          cooperado_id: auth.cooperado.user.id,
        },
      );
      if (assignError) throw new Error(`Falha ao criar assignment: ${assignError.message}`);

      for (const status of ['accepted', 'en_route', 'collected']) {
        const { error: statusError } = await auth.cooperado.client
          .from('pickup_requests')
          .update({ status })
          .eq('id', requestId);
        if (statusError) throw new Error(`Falha ao atualizar status para ${status}: ${statusError.message}`);
      }

      const { data: receipt, error: receiptError } = await auth.cooperado.client
        .from('receipts')
        .insert({
          request_id: requestId,
          cooperado_id: auth.cooperado.user.id,
          receipt_code: makeReceiptCode('SMK'),
          final_notes: 'DRYRUN SMOKE BETA',
        })
        .select('id')
        .single();
      if (receiptError || !receipt) throw new Error(`Falha ao criar recibo: ${receiptError?.message ?? 'sem detalhes'}`);
      receiptId = receipt.id;

      const mediaObjects = [];
      for (let index = 0; index < 2; index += 1) {
        const filePath = `receipts/${receiptId}/${makeReceiptCode(`IMG${index}`).toLowerCase()}.png`;
        const imageBytes = Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
          'base64',
        );

        const { error: uploadError } = await auth.cooperado.client.storage
          .from('eco-media')
          .upload(filePath, imageBytes, { contentType: 'image/png', upsert: false });
        if (uploadError) throw new Error(`Falha upload media ${index + 1}: ${uploadError.message}`);

        const { data: mediaRow, error: mediaError } = await auth.cooperado.client
          .from('media_objects')
          .insert({
            bucket: 'eco-media',
            path: filePath,
            owner_id: auth.cooperado.user.id,
            entity_type: 'receipt',
            entity_id: receiptId,
            mime: 'image/png',
            bytes: imageBytes.length,
            is_public: false,
          })
          .select('id, path')
          .single();
        if (mediaError || !mediaRow) throw new Error(`Falha metadata media ${index + 1}: ${mediaError?.message ?? 'sem detalhes'}`);
        mediaObjects.push(mediaRow);
      }

      const { error: receiptUpdateError } = await auth.cooperado.client
        .from('receipts')
        .update({ proof_photo_path: mediaObjects[0].path })
        .eq('id', receiptId);
      if (receiptUpdateError) throw new Error(`Falha update receipt media: ${receiptUpdateError.message}`);

      const { error: markTestError } = await auth.operator.client.from('receipts_test_marks').upsert(
        {
          receipt_id: receiptId,
          mark: 'DRYRUN',
        },
        { onConflict: 'receipt_id' },
      );
      if (markTestError) throw new Error(`Falha ao marcar receipt DRYRUN: ${markTestError.message}`);

      const { error: postError } = await auth.cooperado.client.from('posts').insert({
        created_by: auth.cooperado.user.id,
        neighborhood_id: neighborhoodId,
        receipt_id: receiptId,
        kind: 'recibo',
        body: 'Post automatico DRYRUN BETA',
      });
      if (postError) throw new Error(`Falha ao criar post recibo: ${postError.message}`);
    });

    await step('Subir app local (se necessario) e validar batch signed-url + /recibos/[id]', async () => {
      if (!baseUrl) {
        await ensureBuildExists();
        baseUrl = `http://127.0.0.1:${smokePort}`;
        serverChild = spawnCrossPlatform(npmCmd, ['run', 'start', '--', '--port', String(smokePort)], {
          stdio: 'ignore',
          env: {
            ...process.env,
            PORT: String(smokePort),
          },
        });
        await waitForHttpReady(baseUrl);
      }

      const auth = await login(TEST_EMAILS.resident);
      const receiptPageResponse = await fetchWithBypass(`${baseUrl}/recibos/${receiptId}`, {
        headers: makeHeaders(),
      });
      if (!receiptPageResponse.ok) {
        const body = await receiptPageResponse.text().catch(() => '');
        const protectionHint = getDeploymentProtectionHint(receiptPageResponse.status, body);
        if (protectionHint) {
          throw new Error(protectionHint);
        }
        throw new Error(`Pagina /recibos/${receiptId} retornou ${receiptPageResponse.status}.`);
      }

      const batchResponse = await fetchWithBypass(
        `${baseUrl}/api/media/signed-url?entity_type=receipt&entity_id=${receiptId}`,
        {
          headers: makeHeaders({
            Authorization: `Bearer ${auth.token}`,
          }),
        },
      );
      if (batchResponse.status !== 200) {
        const body = await batchResponse.text().catch(() => '');
        const protectionHint = getDeploymentProtectionHint(batchResponse.status, body);
        if (protectionHint) {
          throw new Error(protectionHint);
        }
        throw new Error(`Batch signed-url retornou ${batchResponse.status}.`);
      }

      const batchPayload = await batchResponse.json();
      if (!Array.isArray(batchPayload.items) || batchPayload.items.length !== 2) {
        throw new Error(`Batch signed-url deveria retornar 2 itens, retornou ${batchPayload.items?.length ?? 0}.`);
      }

      for (const item of batchPayload.items) {
        const mediaFetch = await fetch(item.signed_url);
        if (!mediaFetch.ok) {
          throw new Error(`Signed URL da midia ${item.media_id} retornou ${mediaFetch.status}.`);
        }
      }
    });

    await step('Validar mural e ranking (score > 0)', async () => {
      const resident = await login(TEST_EMAILS.resident);
      const { data: postRows, error: postError } = await resident.client
        .from('posts')
        .select('id, receipt_id')
        .eq('receipt_id', receiptId)
        .limit(1);
      if (postError) throw new Error(`Falha ao consultar mural: ${postError.message}`);
      if (!postRows || postRows.length === 0) {
        throw new Error('Post de recibo nao encontrado no mural.');
      }

      const anonClient = createClient(supabaseUrl, anonKey);
      const { data: rankRow, error: rankError } = await anonClient
        .from('v_rank_neighborhood_30d')
        .select('slug, impact_score, receipts_count')
        .eq('slug', neighborhoodSlug)
        .maybeSingle();
      if (rankError) throw new Error(`Falha ao consultar ranking: ${rankError.message}`);
      if (!rankRow) throw new Error('Ranking do bairro nao retornou dados.');
      if ((rankRow.impact_score || 0) <= 0 && (rankRow.receipts_count || 0) <= 0) {
        throw new Error('Ranking nao refletiu impacto esperado (>0).');
      }
    });

    await step('Payout (create/close/paid) e export CSV via API', async () => {
      const operator = await login(TEST_EMAILS.operator);
      const today = new Date();
      const start = new Date(today);
      start.setDate(today.getDate() - 6);
      const periodStart = start.toISOString().slice(0, 10);
      const periodEnd = today.toISOString().slice(0, 10);

      const { data: createdPeriodId, error: createPeriodError } = await operator.client.rpc('rpc_create_payout_period', {
        period_start: periodStart,
        period_end: periodEnd,
      });
      if (createPeriodError || !createdPeriodId) {
        throw new Error(`Falha ao criar periodo payout: ${createPeriodError?.message ?? 'sem details'}`);
      }
      periodId = createdPeriodId;

      const { error: closeError } = await operator.client.rpc('rpc_close_payout_period', { period_id: periodId });
      if (closeError) throw new Error(`Falha ao fechar periodo payout: ${closeError.message}`);

      const { error: paidError } = await operator.client.rpc('rpc_mark_payout_paid', {
        period_id: periodId,
        payout_reference: 'DRYRUN-SMOKE',
      });
      if (paidError) throw new Error(`Falha ao marcar payout pago: ${paidError.message}`);

      if (!baseUrl) {
        throw new Error('Base URL do app nao disponivel para validar export CSV.');
      }
      const csvResponse = await fetchWithBypass(`${baseUrl}/api/admin/payouts/export?period_id=${periodId}`, {
        headers: makeHeaders({
          Authorization: `Bearer ${operator.token}`,
        }),
      });
      if (csvResponse.status !== 200) {
        const body = await csvResponse.text().catch(() => '');
        const protectionHint = getDeploymentProtectionHint(csvResponse.status, body);
        if (protectionHint) {
          throw new Error(protectionHint);
        }
        throw new Error(`Export CSV retornou ${csvResponse.status}.`);
      }
      const csvText = await csvResponse.text();
      if (!csvText.includes('cooperado_display_name,cooperado_id,period_start,period_end')) {
        throw new Error('CSV nao contem header esperado.');
      }
    });

    await step('Cleanup opcional de DRYRUN', async () => {
      if (!shouldCleanup) {
        console.log('       ECO_SMOKE_CLEANUP != true, cleanup pulado.');
        return;
      }
      await runCommand(npmCmd, ['run', 'cleanup:dryrun'], 'npm run cleanup:dryrun');
    });

    console.log(`\nRESUMO SMOKE BETA: ${passCount} PASS / ${failCount} FAIL`);
    process.exit(0);
  } catch (error) {
    console.error('\nSMOKE BETA FALHOU.');
    console.error(`Etapa: ${stepNumber}`);
    console.error(`Erro: ${maskBypassSecret(error?.message || String(error))}`);
    console.error(`Causa provavel: ${guessCause(error)}`);
    console.log(`RESUMO SMOKE BETA: ${passCount} PASS / ${failCount} FAIL`);
    process.exit(1);
  } finally {
    await stopServer(serverChild);
  }
}

run();
