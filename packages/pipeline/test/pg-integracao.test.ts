/**
 * Integração com um Postgres de verdade, pelo driver `pg` e pela CLI.
 * Roda quando TEST_DATABASE_URL aponta para um banco descartável (no CI: services.postgres).
 * ATENÇÃO: apaga e recria o schema public desse banco.
 */
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type ConexaoPg, conectar, lerConfigConexao } from '../src/conexao.js';
import { gravarColeta } from '../src/gravar.js';
import { aplicarMigracoes, lerMigracoes } from '../src/migrar.js';
import { lerCandidatos } from '../src/tse/candidatos.js';
import { decodificarLatin1 } from '../src/tse/csv.js';
import { gravarCandidatos } from '../src/tse/gravar-candidatos.js';
import { gravarVinculos } from '../src/vinculo/gravar-vinculos.js';
import { RAIZ_REPO } from './apoio.js';
import { arquivoDeColeta, coletaSenado, PAPEIS_SUPABASE, PASTA_MIGRACOES } from './banco-apoio.js';

const URL_TESTE = process.env.TEST_DATABASE_URL;
// No CI a integração é obrigatória: sem o banco, falha em vez de pular em silêncio.
if (process.env.CI === 'true' && !URL_TESTE) throw new Error('TEST_DATABASE_URL não definida no CI.');
const executar = promisify(execFile);
const TSX = path.join(RAIZ_REPO, 'node_modules', '.bin', 'tsx');
const CLI = path.join(RAIZ_REPO, 'packages', 'pipeline', 'src', 'banco-cli.ts');

async function contar(db: ConexaoPg, tabela: string): Promise<number> {
  const { rows } = await db.query(`select count(*)::int as n from public.${tabela}`);
  return (rows[0] as { n: number }).n;
}

/** Roda a CLI como no workflow, com a conexão só no ambiente. */
async function cli(args: string[], env: Record<string, string>) {
  try {
    const { stdout, stderr } = await executar(TSX, [CLI, ...args], {
      env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', ...env },
      timeout: 60_000,
    });
    return { codigo: 0, saida: stdout + stderr };
  } catch (erro) {
    const e = erro as { code?: number; stdout?: string; stderr?: string };
    return { codigo: e.code ?? 1, saida: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

describe.skipIf(!URL_TESTE)('Postgres de verdade (pg)', () => {
  let db: ConexaoPg;

  beforeAll(async () => {
    db = await conectar(lerConfigConexao({ SUPABASE_DB_URL: URL_TESTE }));
    await db.query('drop schema if exists supabase_migrations cascade; drop schema public cascade; create schema public;');
    await db.query(PAPEIS_SUPABASE);
  }, 60_000);

  afterAll(async () => {
    await db?.fechar();
  });

  it('aplica as migrações uma vez só', async () => {
    const migracoes = await lerMigracoes(PASTA_MIGRACOES);
    expect(await aplicarMigracoes(db, migracoes)).toHaveLength(migracoes.length);
    expect(await aplicarMigracoes(db, migracoes)).toEqual([]);
  });

  it('grava numa transação, repete sem duplicar e desfaz tudo se algo falha', async () => {
    const primeira = await gravarColeta(db, coletaSenado());
    expect(primeira).toMatchObject({ parlamentares: 81, votacoesNovas: 3, votos: 243 });
    const segunda = await gravarColeta(db, coletaSenado());
    expect(segunda).toMatchObject({ votacoesNovas: 0, votacoesAtualizadas: 3, votos: 243 });
    expect(await contar(db, 'voto')).toBe(243);

    // Voto apontando para parlamentar inexistente: a chave estrangeira falha e nada muda.
    const quebrada = coletaSenado();
    quebrada.votos.push({ ...quebrada.votos[0]!, parlamentarId: 'senado:inexistente' });
    await expect(gravarColeta(db, quebrada)).rejects.toThrow();
    expect(await contar(db, 'voto')).toBe(243);
  });

  it('candidatos do TSE e vínculos: grava e repete sem duplicar', async () => {
    const csv = readFileSync(path.join(RAIZ_REPO, 'packages/pipeline/test/fixtures/tse-consulta-cand-2026-sintetico.csv'));
    const { candidatos } = lerCandidatos(decodificarLatin1(csv));
    expect(await gravarCandidatos(db, candidatos)).toEqual({ novos: 7, atualizados: 0, mantidos: 0 });
    expect(await gravarCandidatos(db, candidatos)).toEqual({ novos: 0, atualizados: 7, mantidos: 0 });
    expect(await contar(db, 'candidato_tse')).toBe(7);

    const vinculo = { sqCandidato: candidatos[0]!.sqCandidato, parlamentarId: 'camara:1001', casa: 'camara' as const, metodo: 'nome_civil_uf' as const };
    expect(await gravarVinculos(db, 2026, [vinculo])).toEqual({ antes: 0, depois: 1 });
    expect(await gravarVinculos(db, 2026, [vinculo])).toEqual({ antes: 1, depois: 1 });
    await expect(gravarVinculos(db, 2026, [{ ...vinculo, parlamentarId: 'senado:1' }])).rejects.toThrow(); // casa ≠ prefixo
    expect(await contar(db, 'vinculo_parlamentar')).toBe(1);
  });

  it('visitante anônimo lê, mas não escreve (RLS)', async () => {
    await db.query('begin');
    try {
      await db.query('set local role anon');
      const { rows } = await db.query('select count(*)::int as n from public.votacao');
      expect((rows[0] as { n: number }).n).toBe(3);
      await expect(db.query("delete from public.voto where votacao_id like 'senado:%'")).rejects.toThrow(/permission denied/);
    } finally {
      await db.query('rollback');
    }
  });

  it('CLI: migra e grava só com a conexão no ambiente; erro de senha não vaza a senha', async () => {
    const pasta = await mkdtemp(path.join(tmpdir(), 'gravar-'));
    const arquivo = await arquivoDeColeta(pasta);
    const env = { SUPABASE_DB_URL: URL_TESTE! };

    const migrar = await cli(['migrar'], env);
    expect(migrar).toMatchObject({ codigo: 0 });
    expect(migrar.saida).toContain('nenhuma migração pendente');

    const gravar = await cli(['gravar', '--arquivo', arquivo], env);
    expect(gravar.codigo).toBe(0);
    expect(gravar.saida).toContain('3 atualizadas');

    const errada = new URL(URL_TESTE!);
    errada.password = 'senhaErradaQueNaoPodeAparecer';
    const recusada = await cli(['gravar', '--arquivo', arquivo], { SUPABASE_DB_URL: errada.toString() });
    expect(recusada.codigo).not.toBe(0);
    expect(recusada.saida).toMatch(/senha recusados/);
    expect(recusada.saida).not.toContain('senhaErradaQueNaoPodeAparecer');
  }, 120_000);
});
