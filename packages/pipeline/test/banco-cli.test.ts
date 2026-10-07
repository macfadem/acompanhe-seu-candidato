import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { arquivosDaPasta, lerArquivos, resumoGravacao } from '../src/banco-cli.js';
import { aplicarMigracoes, lerMigracoes } from '../src/migrar.js';
import { arquivoDeColeta, bancoSoComPapeis, coletaSenado, conexaoPglite, contar, PASTA_MIGRACOES } from './banco-apoio.js';

describe('migrações', () => {
  it('aplica em ordem, registra no histórico do Supabase e não repete', async () => {
    const db = await bancoSoComPapeis();
    const conexao = conexaoPglite(db);
    const migracoes = await lerMigracoes(PASTA_MIGRACOES);
    expect(migracoes.length).toBeGreaterThan(0);

    const primeira = await aplicarMigracoes(conexao, migracoes);
    expect(primeira).toEqual(migracoes.map((m) => `${m.versao}_${m.nome}`));
    expect(await contar(db, 'votacao')).toBe(0);
    expect(await aplicarMigracoes(conexao, migracoes)).toEqual([]);
    const { rows } = await db.query<{ n: number }>('select count(*)::int as n from supabase_migrations.schema_migrations');
    expect(rows[0]?.n).toBe(migracoes.length);
  });

  it('migração com erro é desfeita e não entra no histórico', async () => {
    const db = await bancoSoComPapeis();
    const conexao = conexaoPglite(db);
    const ruim = [{ versao: '20990101000000', nome: 'quebrada', sql: 'create table public.t (id int); select * from tabela_que_nao_existe;' }];
    await expect(aplicarMigracoes(conexao, ruim)).rejects.toThrow(/20990101000000_quebrada/);
    const { rows } = await db.query<{ t: string | null }>("select to_regclass('public.t')::text as t");
    expect(rows[0]?.t).toBeNull();
    expect(await aplicarMigracoes(conexao, [])).toEqual([]);
  });
});

describe('arquivos da coleta', () => {
  it('lê e valida o arquivo inteiro', async () => {
    const pasta = await mkdtemp(path.join(tmpdir(), 'coleta-'));
    const caminho = await arquivoDeColeta(pasta);
    const [lido] = await lerArquivos([caminho]);
    expect(lido?.coleta.votacoes).toHaveLength(3);
    expect(lido?.coleta.votos).toHaveLength(243);
    expect(await arquivosDaPasta(pasta)).toEqual([caminho]);
    expect(await arquivosDaPasta(path.join(pasta, 'nao-existe'))).toEqual([]);
  });

  it('recusa arquivo fora do formato ou com referências quebradas, sem abrir conexão', async () => {
    const pasta = await mkdtemp(path.join(tmpdir(), 'coleta-'));
    const coleta = coletaSenado();
    const categoriaInvalida = await arquivoDeColeta(pasta, 'votacoes_a.json', {
      ...coleta,
      votos: coleta.votos.map((v, i) => (i === 0 ? { ...v, categoria: 'talvez' } : v)),
    });
    await expect(lerArquivos([categoriaInvalida])).rejects.toThrow(/votos\[0\]\.categoria/);

    const orfao = await arquivoDeColeta(pasta, 'votacoes_b.json', {
      ...coleta,
      votos: [...coleta.votos, { ...coleta.votos[0]!, votacaoId: 'senado:999999' }],
    });
    await expect(lerArquivos([orfao])).rejects.toThrow(/votação ausente: senado:999999/);

    const quebrado = path.join(pasta, 'votacoes_c.json');
    await writeFile(quebrado, '{', 'utf8');
    await expect(lerArquivos([quebrado])).rejects.toThrow(/não é um JSON legível/);
  });

  it('resumo da gravação para a página da execução', () => {
    const md = resumoGravacao(
      [{ arquivo: 'dados/votacoes_x.json', resultado: { parlamentares: 81, votacoesNovas: 3, votacoesAtualizadas: 0, votacoesMantidas: 0, votos: 243 } }],
      ['20261007000000_votacoes'],
    );
    expect(md).toContain('| votacoes_x.json | 81 | 3 | 0 | 0 | 243 |');
    expect(md).toContain('`20261007000000_votacoes`');
  });
});
