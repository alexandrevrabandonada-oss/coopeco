import { promises as fs } from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: '.env.local' });

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const DB_URL = process.env.SUPABASE_DB_URL;
const TLS_MODE = process.env.ECO_DB_TLS_MODE || 'verify';
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_CI = process.env.CI === '1' || process.env.CI === 'true';
const IS_PROD = NODE_ENV === 'production';

if (!DB_URL) {
  console.error('ERRO: SUPABASE_DB_URL nao foi encontrado no .env.local.');
  process.exit(1);
}

if (!['verify', 'no-verify'].includes(TLS_MODE)) {
  console.error(`ERRO: ECO_DB_TLS_MODE invalido (${TLS_MODE}). Use "verify" ou "no-verify".`);
  process.exit(1);
}

if (TLS_MODE === 'no-verify' && (IS_PROD || IS_CI)) {
  console.error(
    `ERRO: ECO_DB_TLS_MODE=no-verify bloqueado em contexto protegido (NODE_ENV=${NODE_ENV}, CI=${IS_CI ? '1' : '0'}).`,
  );
  process.exit(1);
}

if (TLS_MODE === 'no-verify') {
  console.warn('[WARNING] ECO_DB_TLS_MODE=no-verify ativo. TLS sem validacao de certificado (apenas dev).');
}

const migrationNamePattern = /^(\d+)_([^.]+)\.sql$/;

function buildConnectionString(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  const sslmode = parsed.searchParams.get('sslmode');
  if (TLS_MODE === 'verify') {
    if (!sslmode || sslmode === 'disable' || sslmode === 'allow' || sslmode === 'prefer' || sslmode === 'require' || sslmode === 'no-verify') {
      parsed.searchParams.set('sslmode', 'verify-full');
    }
  } else if (TLS_MODE === 'no-verify') {
    parsed.searchParams.set('sslmode', 'no-verify');
  }

  return parsed.toString();
}

async function ensureHistoryTable(client) {
  await client.query(`
    CREATE SCHEMA IF NOT EXISTS supabase_migrations;
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
      version text PRIMARY KEY,
      name text NOT NULL,
      statements text[] NOT NULL
    );
  `);
}

async function readMigrationFiles() {
  const entries = await fs.readdir(MIGRATIONS_DIR, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

async function applyMigrations() {
  const connectionString = buildConnectionString(DB_URL);
  const client = new pg.Client({
    connectionString,
    ssl: TLS_MODE === 'no-verify'
      ? { rejectUnauthorized: false }
      : { rejectUnauthorized: true },
  });
  let applied = 0;
  let skipped = 0;
  let errors = 0;

  try {
    await client.connect();
    await ensureHistoryTable(client);

    const files = await readMigrationFiles();
    if (files.length === 0) {
      console.log('Nenhuma migration encontrada em supabase/migrations.');
    }

    for (const fileName of files) {
      const match = fileName.match(migrationNamePattern);
      if (!match) {
        console.error(`[ERROR] Nome de migration invalido: ${fileName}`);
        errors += 1;
        continue;
      }

      const [, version, name] = match;
      const checkResult = await client.query(
        'SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = $1',
        [version],
      );

      if (checkResult.rowCount > 0) {
        skipped += 1;
        console.log(`[SKIP] ${fileName}`);
        continue;
      }

      const fullPath = path.join(MIGRATIONS_DIR, fileName);
      const sql = await fs.readFile(fullPath, 'utf8');

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          `
          INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
          VALUES ($1, $2, $3)
          `,
          [version, name, [fileName]],
        );
        await client.query('COMMIT');
        applied += 1;
        console.log(`[APPLY] ${fileName}`);
      } catch (error) {
        await client.query('ROLLBACK');
        errors += 1;
        console.error(`[ERROR] ${fileName}: ${error.message}`);
      }
    }

    // Instance-wide PostgREST reload
    try {
      await client.query("NOTIFY pgrst, 'reload schema'");
      console.log('[SUCCESS] PostgREST schema reload notified.');
    } catch (reloadErr) {
      console.warn(`[WARNING] Failed to notify schema reload: ${reloadErr.message}`);
    }

  } catch (error) {
    errors += 1;
    console.error(`ERRO FATAL NO DB APPLY: ${error.message}`);
  } finally {
    await client.end().catch(() => undefined);
  }

  console.log('\n--- ECO DB APPLY SUMMARY ---');
  console.log(`Applied: ${applied}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);

  if (errors > 0) {
    process.exit(1);
  }
}

applyMigrations();
