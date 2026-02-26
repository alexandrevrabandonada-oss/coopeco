import { spawn } from 'node:child_process';
import dotenv from 'dotenv';
import { fetchWithBypass, getDeploymentProtectionHint, hasBypassSecret, maskBypassSecret } from './_fetchWithBypass.mjs';

dotenv.config({ path: '.env.local' });

const baseUrlRaw = process.env.ECO_SMOKE_BASE_URL || '';
const stagingPass = process.env.ECO_SMOKE_STAGING_PASS || process.env.ECO_STAGING_PASS || '';
const vercelAutomationBypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '';

if (!baseUrlRaw) {
  console.error('ERRO: ECO_SMOKE_BASE_URL e obrigatorio para smoke:staging.');
  process.exit(1);
}

let baseUrl;
try {
  const parsed = new URL(baseUrlRaw);
  parsed.hash = '';
  parsed.search = '';
  baseUrl = parsed.toString().replace(/\/$/, '');
} catch {
  console.error(`ERRO: ECO_SMOKE_BASE_URL invalido (${baseUrlRaw}).`);
  process.exit(1);
}

function makeHeaders() {
  const headers = {};
  if (stagingPass) {
    headers['x-eco-gate'] = stagingPass;
    headers['x-eco-staging-pass'] = stagingPass;
  }
  return headers;
}

function stepLabel(name) {
  return `[SMOKE:STAGING] ${name}`;
}

async function fetchEndpoint(url) {
  const response = await fetchWithBypass(url, {
    method: 'GET',
    headers: makeHeaders(),
  });
  const body = await response.text().catch(() => '');
  return { status: response.status, body };
}

function throwEndpointError(url, status, body) {
  const protectionHint = getDeploymentProtectionHint(status, body);
  if (protectionHint) {
    throw new Error(maskBypassSecret(`${protectionHint} Endpoint ${url} retornou ${status}.`));
  }
  throw new Error(maskBypassSecret(`Endpoint ${url} retornou ${status}. Body: ${String(body || '').slice(0, 240)}`));
}

function runBetaSmoke() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['tools/eco-smoke-beta.mjs'],
      {
        stdio: 'inherit',
        env: {
          ...process.env,
          ECO_SMOKE_BASE_URL: baseUrl,
          ECO_SMOKE_STAGING_PASS: stagingPass,
        },
      },
    );

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`smoke:beta retornou exit code ${code}.`));
    });
  });
}

async function run() {
  let healthMissing = false;

  console.log(stepLabel(`Base URL: ${baseUrl}`));
  if (!vercelAutomationBypassSecret) {
    console.log(stepLabel('VERCEL_AUTOMATION_BYPASS_SECRET ausente; tentando sem bypass de Deployment Protection.'));
  } else if (hasBypassSecret()) {
    console.log(stepLabel('Bypass de Deployment Protection habilitado por env.'));
  }

  console.log(stepLabel('Validando /'));
  const rootUrl = `${baseUrl}/`;
  const rootResult = await fetchEndpoint(rootUrl);
  if (rootResult.status !== 200) {
    if (rootResult.status === 401 || rootResult.status === 403) {
      throwEndpointError(rootUrl, rootResult.status, rootResult.body);
    }
    throwEndpointError(rootUrl, rootResult.status, rootResult.body);
  }
  console.log(stepLabel('OK /'));

  console.log(stepLabel('Validando /api/health'));
  const healthUrl = `${baseUrl}/api/health`;
  const healthResult = await fetchEndpoint(healthUrl);
  if (healthResult.status === 200) {
    console.log(stepLabel('OK /api/health'));
  } else if (healthResult.status === 404) {
    healthMissing = true;
    console.log(stepLabel('WARN health route missing in this deployment'));
  } else {
    throwEndpointError(healthUrl, healthResult.status, healthResult.body);
  }

  console.log(stepLabel('Executando smoke:beta remoto'));
  await runBetaSmoke();
  console.log(stepLabel('PASS smoke remoto'));

  if (healthMissing) {
    console.log(stepLabel('PASS (health optional: 404 permitido)'));
    console.log(stepLabel('PENDENCIA: Preview deployment likely outdated; redeploy later.'));
    return;
  }

  console.log(stepLabel('PASS'));
}

run().catch((error) => {
  console.error(stepLabel(`FAIL ${maskBypassSecret(error?.message || String(error))}`));
  process.exit(1);
});
