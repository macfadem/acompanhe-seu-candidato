import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { RAIZ_REPO } from './apoio.js';

const PASTA_MIGRACOES = path.join(RAIZ_REPO, 'supabase', 'migrations');

/** Postgres em memória (PGlite) com os papéis e privilégios padrão do Supabase e todas as migrações. */
export async function bancoEmMemoria(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  `);
  for (const arquivo of readdirSync(PASTA_MIGRACOES).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(path.join(PASTA_MIGRACOES, arquivo), 'utf8'));
  }
  return db;
}

export async function contar(db: PGlite, tabela: string, onde = 'true'): Promise<number> {
  const { rows } = await db.query<{ n: number }>(`select count(*)::int as n from public.${tabela} where ${onde}`);
  return rows[0]?.n ?? 0;
}
