/**
 * Aplica as migrações de supabase/migrations que ainda não estão no banco, em ordem,
 * cada uma na sua transação. Registra em supabase_migrations.schema_migrations — a mesma
 * tabela da CLI do Supabase, então as duas ferramentas enxergam o mesmo histórico.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ConexaoSql } from './gravar.js';

export interface Migracao {
  versao: string;
  nome: string;
  sql: string;
}

const PADRAO = /^(\d{14})_([a-z0-9_]+)\.sql$/;

/** Lê as migrações da pasta, em ordem de versão. Arquivo com nome fora do padrão é erro. */
export async function lerMigracoes(pasta: string): Promise<Migracao[]> {
  const arquivos = (await readdir(pasta)).filter((f) => f.endsWith('.sql')).sort();
  const migracoes: Migracao[] = [];
  for (const arquivo of arquivos) {
    const m = PADRAO.exec(arquivo);
    if (!m) throw new Error(`Migração com nome fora do padrão AAAAMMDDHHMMSS_nome.sql: ${arquivo}`);
    migracoes.push({ versao: m[1]!, nome: m[2]!, sql: await readFile(path.join(pasta, arquivo), 'utf8') });
  }
  return migracoes;
}

/** Devolve as versões aplicadas agora (vazio se o banco já estava em dia). */
export async function aplicarMigracoes(db: ConexaoSql, migracoes: readonly Migracao[]): Promise<string[]> {
  await db.query('create schema if not exists supabase_migrations');
  await db.query(
    'create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text)',
  );
  const { rows } = await db.query('select version from supabase_migrations.schema_migrations');
  const aplicadas = new Set((rows as Array<{ version: string }>).map((r) => r.version));

  const novas: string[] = [];
  for (const m of migracoes) {
    if (aplicadas.has(m.versao)) continue;
    await db.query('begin');
    try {
      await db.query(m.sql);
      await db.query('insert into supabase_migrations.schema_migrations (version, statements, name) values ($1, $2, $3)', [
        m.versao,
        [m.sql],
        m.nome,
      ]);
      await db.query('commit');
    } catch (erro) {
      await db.query('rollback');
      throw new Error(`Falha ao aplicar a migração ${m.versao}_${m.nome}: ${erro instanceof Error ? erro.message : erro}`, {
        cause: erro,
      });
    }
    novas.push(`${m.versao}_${m.nome}`);
  }
  return novas;
}
