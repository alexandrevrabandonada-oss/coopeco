import { promises as fs } from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: '.env.local' });

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_CI = process.env.CI === '1' || process.env.CI === 'true';
const IS_PROD = NODE_ENV === 'production';
const DB_URL = process.env.SUPABASE_DB_URL || '';
const CERT_PATH_ENV = process.env.ECO_DB_SSL_ROOT_CERT_PATH || '';
const DEFAULT_CERT_PATH = path.join(process.cwd(), 'tools', '_tls', 'eco-supabase-ca.pem');

if (IS_PROD || IS_CI) {
  console.error(`ERRO: tls:provision permitido apenas em dev local (NODE_ENV=${NODE_ENV}, CI=${IS_CI ? '1' : '0'}).`);
  process.exit(1);
}

if (!DB_URL) {
  console.error('ERRO: SUPABASE_DB_URL nao encontrado.');
  process.exit(1);
}

function buildConnectionString(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return rawUrl;
  }
  parsed.searchParams.delete('sslmode');
  return parsed.toString();
}

function certToPem(raw) {
  const b64 = raw.toString('base64');
  const lines = b64.match(/.{1,64}/g) || [];
  return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----\n`;
}

function collectCertificateChain(tlsSocket) {
  const chain = [];
  const seen = new Set();
  let cert = tlsSocket.getPeerCertificate(true);

  while (cert && cert.raw) {
    const key = cert.fingerprint256 || cert.raw.toString('base64');
    if (seen.has(key)) break;
    seen.add(key);
    chain.push(cert);

    const issuer = cert.issuerCertificate;
    if (!issuer || !issuer.raw) break;
    const issuerKey = issuer.fingerprint256 || issuer.raw.toString('base64');
    if (issuerKey === key) break;
    cert = issuer;
  }

  return chain;
}

async function run() {
  const targetPath = CERT_PATH_ENV
    ? path.resolve(process.cwd(), CERT_PATH_ENV)
    : DEFAULT_CERT_PATH;

  const client = new pg.Client({
    connectionString: buildConnectionString(DB_URL),
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const tlsSocket = client.connection?.stream;
    if (!tlsSocket || typeof tlsSocket.getPeerCertificate !== 'function') {
      throw new Error('Nao foi possivel acessar o socket TLS da conexao Postgres.');
    }

    const chain = collectCertificateChain(tlsSocket);
    if (chain.length === 0) {
      throw new Error('Nenhum certificado foi extraido da conexao TLS.');
    }

    const pem = chain.map((cert) => certToPem(cert.raw)).join('');
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, pem, 'utf8');

    console.log(`[OK] Cadeia TLS extraida e salva em: ${targetPath}`);
    console.log('[OK] Proximo passo: rode npm run db:apply com ECO_DB_TLS_MODE=verify.');
    if (!CERT_PATH_ENV) {
      console.log(`[OK] Caminho padrao usado. Opcional: exporte ECO_DB_SSL_ROOT_CERT_PATH=${targetPath}`);
    }
  } finally {
    await client.end().catch(() => undefined);
  }
}

run().catch((error) => {
  console.error(`ERRO tls:provision: ${error?.message || String(error)}`);
  process.exit(1);
});
