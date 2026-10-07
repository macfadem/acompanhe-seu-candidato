/**
 * Banco (Supabase/Postgres):
 *
 *   npm run migrar                 aplica as migrações pendentes de supabase/migrations
 *   npm run gravar                 grava todos os dados/votacoes_*.json
 *   npm run gravar -- --arquivo dados/votacoes_2026-06-01_2026-06-30.json
 *
 * Conexão: SUPABASE_DB_URL (pooler em modo sessão) e SUPABASE_DB_CA (certificado do
 * Supabase), só por variável de ambiente. Nada disso é impresso.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { ArquivoColetaCompleto, conferirReferencias } from './arquivo-coleta.js';
import { conectar, explicarErroConexao, lerConfigConexao } from './conexao.js';
import { escreverResumoExecucao } from './github.js';
import { gravarColeta, type ResultadoGravacao } from './gravar.js';
import { aplicarMigracoes, lerMigracoes } from './migrar.js';
import type { Coleta } from './tipos.js';
import { validar } from './validar.js';

const PASTA_MIGRACOES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../supabase/migrations');

const AJUDA = `Uso:
  npm run migrar                       aplica as migrações pendentes
  npm run gravar -- [opções]           grava arquivos da coleta no banco

Opções de "gravar":
  --arquivo CAMINHO   arquivo de "npm run votacoes" (pode repetir)
  --pasta PASTA       sem --arquivo, grava todos os votacoes_*.json da pasta (padrão: dados)

Variáveis de ambiente (nunca no código):
  SUPABASE_DB_URL     postgresql://postgres.<ref>:<senha>@<host do pooler>:5432/postgres
  SUPABASE_DB_CA      conteúdo do certificado do Supabase (obrigatório fora de localhost)`;

export interface ArquivoLido {
  caminho: string;
  coleta: Coleta;
}

/** Lê e valida os arquivos antes de qualquer conexão: um arquivo inválido impede a gravação de todos. */
export async function lerArquivos(caminhos: readonly string[]): Promise<ArquivoLido[]> {
  const lidos: ArquivoLido[] = [];
  for (const caminho of caminhos) {
    let bruto: unknown;
    try {
      bruto = JSON.parse(await readFile(caminho, 'utf8'));
    } catch (erro) {
      throw new Error(`${caminho}: não é um JSON legível (${erro instanceof Error ? erro.message : erro})`);
    }
    const coleta = validar(ArquivoColetaCompleto, bruto, caminho);
    const problemas = conferirReferencias(coleta);
    if (problemas.length > 0) throw new Error(`${caminho}: referências inválidas\n- ${problemas.join('\n- ')}`);
    lidos.push({ caminho, coleta });
  }
  return lidos;
}

export async function arquivosDaPasta(pasta: string): Promise<string[]> {
  const nomes = await readdir(pasta).catch(() => [] as string[]);
  return nomes
    .filter((n) => /^votacoes_.*\.json$/.test(n))
    .sort()
    .map((n) => path.join(pasta, n));
}

export function resumoGravacao(itens: ReadonlyArray<{ arquivo: string; resultado: ResultadoGravacao }>, migracoes: readonly string[]): string {
  const linhas = ['## Gravação no banco', ''];
  if (migracoes.length > 0) linhas.push(`Migrações aplicadas agora: ${migracoes.map((m) => `\`${m}\``).join(', ')}`, '');
  linhas.push(
    '| Arquivo | Parlamentares | Votações novas | Atualizadas | Mantidas | Votos |',
    '|---|---|---|---|---|---|',
    ...itens.map(
      ({ arquivo, resultado: r }) =>
        `| ${path.basename(arquivo)} | ${r.parlamentares} | ${r.votacoesNovas} | ${r.votacoesAtualizadas} | ${r.votacoesMantidas} | ${r.votos} |`,
    ),
    '',
    '"Mantidas": já tinham votos individuais no banco e vieram sem eles desta vez (ex.: falha passageira da API) — não foram rebaixadas.',
    '',
  );
  return linhas.join('\n');
}

async function migrar(): Promise<string[]> {
  const config = lerConfigConexao();
  const migracoes = await lerMigracoes(PASTA_MIGRACOES);
  const db = await conectar(config);
  try {
    return await aplicarMigracoes(db, migracoes);
  } finally {
    await db.fechar();
  }
}

async function gravar(caminhos: string[]): Promise<void> {
  if (caminhos.length === 0) throw new Error('Nenhum arquivo votacoes_*.json para gravar.');
  const arquivos = await lerArquivos(caminhos);
  const config = lerConfigConexao();
  const db = await conectar(config);
  const itens: Array<{ arquivo: string; resultado: ResultadoGravacao }> = [];
  try {
    for (const { caminho, coleta } of arquivos) {
      const resultado = await gravarColeta(db, coleta);
      itens.push({ arquivo: caminho, resultado });
      console.log(
        `${path.basename(caminho)}: ${resultado.parlamentares} parlamentares, ${resultado.votacoesNovas} votações novas, ` +
          `${resultado.votacoesAtualizadas} atualizadas, ${resultado.votacoesMantidas} mantidas, ${resultado.votos} votos`,
      );
    }
  } finally {
    await db.fechar();
  }
  await escreverResumoExecucao(resumoGravacao(itens, []));
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    options: {
      arquivo: { type: 'string', multiple: true },
      pasta: { type: 'string', default: 'dados' },
      ajuda: { type: 'boolean', short: 'h', default: false },
    },
    allowPositionals: true,
    strict: true,
  });
  const comando = positionals[0];
  if (values.ajuda || (comando !== 'migrar' && comando !== 'gravar')) {
    console.log(AJUDA);
    if (!values.ajuda) process.exitCode = 1;
    return;
  }
  if (comando === 'migrar') {
    const novas = await migrar();
    console.log(novas.length === 0 ? 'Banco em dia: nenhuma migração pendente.' : `Migrações aplicadas: ${novas.join(', ')}`);
    if (novas.length > 0) await escreverResumoExecucao(`## Migrações\n\nAplicadas agora: ${novas.map((m) => `\`${m}\``).join(', ')}\n`);
    return;
  }
  await gravar(values.arquivo?.length ? values.arquivo : await arquivosDaPasta(values.pasta));
}

// Só roda como programa (os testes importam as funções acima).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((erro: unknown) => {
    console.error(explicarErroConexao(erro));
    process.exitCode = 1;
  });
}
