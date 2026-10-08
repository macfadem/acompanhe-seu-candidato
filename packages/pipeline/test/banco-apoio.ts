import { readdirSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import type { ConexaoSql } from '../src/gravar.js';
import { normalizarRespostaSenado, RespostaVotacoesSenado } from '../src/senado.js';
import { validar } from '../src/validar.js';
import { fixture, RAIZ_REPO } from './apoio.js';

export const PASTA_MIGRACOES = path.join(RAIZ_REPO, 'supabase', 'migrations');

/** Papéis e privilégios padrão de um projeto Supabase (o Postgres comum não os tem). */
export const PAPEIS_SUPABASE = `
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  end $$;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
`;

/** PGlite sem migrações, só com os papéis do Supabase. */
export async function bancoSoComPapeis(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(PAPEIS_SUPABASE);
  return db;
}

/**
 * Adapta o PGlite à interface da gravação. Sem parâmetros usa `exec` (aceita vários
 * comandos, como o protocolo simples do `pg`); com parâmetros, `query`.
 */
export function conexaoPglite(db: PGlite): ConexaoSql {
  return {
    async query(sql, params) {
      if (params) return db.query(sql, params);
      const resultados = await db.exec(sql);
      return { rows: resultados.at(-1)?.rows ?? [] };
    },
  };
}

/** Postgres em memória (PGlite) com os papéis e privilégios padrão do Supabase e todas as migrações. */
export async function bancoEmMemoria(): Promise<PGlite> {
  const db = await bancoSoComPapeis();
  for (const arquivo of readdirSync(PASTA_MIGRACOES).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(path.join(PASTA_MIGRACOES, arquivo), 'utf8'));
  }
  return db;
}

export async function contar(db: PGlite, tabela: string, onde = 'true'): Promise<number> {
  const { rows } = await db.query<{ n: number }>(`select count(*)::int as n from public.${tabela} where ${onde}`);
  return rows[0]?.n ?? 0;
}

/** Coleta real do Senado (junho/2026: 3 votações, 81 parlamentares, 243 votos). */
export const coletaSenado = () =>
  normalizarRespostaSenado(validar(RespostaVotacoesSenado, fixture('senado-votacao-2026-06.json'), 'fixture'));

/** Grava um arquivo no mesmo formato da saída de `npm run votacoes`. */
export async function arquivoDeColeta(pasta: string, nome = 'votacoes_2026-06-01_2026-06-30.json', conteudo?: unknown) {
  const caminho = path.join(pasta, nome);
  const coleta = coletaSenado();
  const dados = conteudo ?? {
    geradoEm: '2026-10-07T12:00:00.000Z',
    intervalo: { de: '2026-06-01', ate: '2026-06-30' },
    casas: ['senado'],
    fontes: ['Senado'],
    ...coleta,
  };
  await writeFile(caminho, JSON.stringify(dados), 'utf8');
  return caminho;
}
