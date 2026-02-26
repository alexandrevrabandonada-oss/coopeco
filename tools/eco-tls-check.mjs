import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const tlsMode = process.env.ECO_DB_TLS_MODE || 'verify';
const nodeEnv = process.env.NODE_ENV || 'development';
const isCI = process.env.CI === '1' || process.env.CI === 'true';
const isProd = nodeEnv === 'production';
const dbUrl = process.env.SUPABASE_DB_URL || '';

if (!['verify', 'no-verify'].includes(tlsMode)) {
  console.error(`ERRO: ECO_DB_TLS_MODE invalido (${tlsMode}). Use "verify" ou "no-verify".`);
  process.exit(1);
}

if (tlsMode === 'no-verify' && (isProd || isCI)) {
  console.error(
    `ERRO: ECO_DB_TLS_MODE=no-verify bloqueado para NODE_ENV=${nodeEnv} CI=${isCI ? '1' : '0'}.`,
  );
  process.exit(1);
}

if (dbUrl.includes('sslmode=no-verify') && (isProd || isCI)) {
  console.error('ERRO: SUPABASE_DB_URL contem sslmode=no-verify em contexto de CI/producao.');
  process.exit(1);
}

if (tlsMode === 'no-verify') {
  console.warn('[WARNING] TLS check: no-verify ativo (permitido somente em dev local).');
}

console.log(`[OK] TLS check concluido (mode=${tlsMode}, NODE_ENV=${nodeEnv}, CI=${isCI ? '1' : '0'}).`);
