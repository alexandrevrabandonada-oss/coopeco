import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import path from 'node:path';

dotenv.config({ path: '.env.local' });

const tlsMode = process.env.ECO_DB_TLS_MODE || 'verify';
const nodeEnv = process.env.NODE_ENV || 'development';
const isCI = process.env.CI === '1' || process.env.CI === 'true';
const isProd = nodeEnv === 'production';
const dbUrl = process.env.SUPABASE_DB_URL || '';
const sslRootCertPathEnv = process.env.ECO_DB_SSL_ROOT_CERT_PATH || '';
const defaultProvisionedCertPath = path.join(process.cwd(), 'tools', '_tls', 'eco-supabase-ca.pem');
const resolvedEnvCertPath = sslRootCertPathEnv
  ? path.resolve(process.cwd(), sslRootCertPathEnv)
  : '';
const hasEnvCert = resolvedEnvCertPath ? existsSync(resolvedEnvCertPath) : false;
const hasProvisionedCert = existsSync(defaultProvisionedCertPath);

if (!['verify', 'no-verify'].includes(tlsMode)) {
  console.error(`ERRO: ECO_DB_TLS_MODE invalido (${tlsMode}). Use "verify" ou "no-verify".`);
  process.exit(1);
}

if (tlsMode === 'no-verify') {
  console.error(
    `ERRO: ECO_DB_TLS_MODE=no-verify bloqueado (NODE_ENV=${nodeEnv} CI=${isCI ? '1' : '0'}). Use TLS verificado.`,
  );
  process.exit(1);
}

if (dbUrl.includes('sslmode=no-verify') && (isProd || isCI)) {
  console.error('ERRO: SUPABASE_DB_URL contem sslmode=no-verify em contexto de CI/producao.');
  process.exit(1);
}

if (resolvedEnvCertPath && !hasEnvCert) {
  console.error(`ERRO: ECO_DB_SSL_ROOT_CERT_PATH definido, mas arquivo nao existe: ${resolvedEnvCertPath}`);
  process.exit(1);
}

if (!isProd && !isCI && !hasEnvCert && !hasProvisionedCert) {
  console.error(
    `ERRO: Em dev, TLS verificado exige CA local. Rode "npm run tls:provision" ou defina ECO_DB_SSL_ROOT_CERT_PATH valido.`,
  );
  process.exit(1);
}

console.log(
  `[OK] TLS check concluido (mode=${tlsMode}, NODE_ENV=${nodeEnv}, CI=${isCI ? '1' : '0'}, cert=${hasEnvCert ? resolvedEnvCertPath : hasProvisionedCert ? defaultProvisionedCertPath : 'system-default'}).`,
);
