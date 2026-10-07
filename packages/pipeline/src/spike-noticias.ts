/**
 * Spike de notícias: mede se a GDELT encontra matérias sobre uma amostra de
 * parlamentares e de votações recentes. Roda no computador ou no GitHub Actions
 * (workflow "Spike de notícias"), onde também escreve o resumo na página da execução.
 *
 *   npm run votacoes -- --de 2026-07-10 --ate 2026-10-07
 *   npm run spike:noticias -- --arquivo dados/votacoes_2026-07-10_2026-10-07.json
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { hojeEmBrasilia } from './datas.js';
import { escreverResumoExecucao, noGithubActions, urlExecucao } from './github.js';
import { criarCliente } from './http.js';
import {
  anotacoesSpike,
  ArquivoColeta,
  executarSpike,
  instrucoesDownload,
  montarAlvos,
  paraCsv,
  paraResumo,
} from './spike/executar.js';
import { validar } from './validar.js';

const AJUDA = `Uso: npm run spike:noticias -- --arquivo dados/votacoes_<de>_<ate>.json [opções]

  --arquivo CAMINHO    saída de "npm run votacoes" (de preferência dos últimos 3 meses)
  --semente N          semente do sorteio (padrão: 20261007)
  --deputados N        quantos deputados sortear (padrão: 14)
  --senadores N        quantos senadores sortear (padrão: 6)
  --votacoes N         quantas votações sortear (padrão: 10)
  --intervalo S        segundos entre consultas (padrão: 6)
  --saida PASTA        onde gravar CSV e resumo (padrão: dados/spike)
  --prazo MIN          para de consultar depois de MIN minutos (padrão: 0 = sem prazo)
  --artefato NOME      nome do artefato no GitHub Actions, citado no resumo (padrão: spike-noticias)`;

function inteiro(valor: string, nome: string, minimo: number): number {
  const n = Number(valor);
  if (!Number.isInteger(n) || n < minimo) throw new Error(`--${nome} deve ser um inteiro ≥ ${minimo}`);
  return n;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      arquivo: { type: 'string' },
      semente: { type: 'string', default: '20261007' },
      deputados: { type: 'string', default: '14' },
      senadores: { type: 'string', default: '6' },
      votacoes: { type: 'string', default: '10' },
      intervalo: { type: 'string', default: '6' },
      saida: { type: 'string', default: path.join('dados', 'spike') },
      artefato: { type: 'string', default: 'spike-noticias' },
      prazo: { type: 'string', default: '0' },
      ajuda: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
  });
  if (values.ajuda || !values.arquivo) {
    console.log(AJUDA);
    if (!values.arquivo && !values.ajuda) process.exitCode = 1;
    return;
  }

  const opcoes = {
    semente: inteiro(values.semente, 'semente', 0),
    deputados: inteiro(values.deputados, 'deputados', 0),
    senadores: inteiro(values.senadores, 'senadores', 0),
    votacoes: inteiro(values.votacoes, 'votacoes', 0),
    intervaloMs: inteiro(values.intervalo, 'intervalo', 5) * 1000,
    hoje: hojeEmBrasilia(),
  };
  const coleta = validar(ArquivoColeta, JSON.parse(await readFile(values.arquivo, 'utf8')), values.arquivo);
  const alvos = montarAlvos(coleta, opcoes);
  if (alvos.length === 0) throw new Error('Nenhum alvo: o arquivo não tem parlamentares nem votações recentes.');
  if (!alvos.some((a) => a.tipo === 'votacao')) {
    console.warn('Aviso: nenhuma votação dos últimos 85 dias no arquivo; rode a coleta de um período recente.');
  }

  const minutos = Math.ceil((alvos.length * opcoes.intervaloMs) / 60_000);
  console.log(`Consultando a GDELT para ${alvos.length} alvos (~${minutos} min)…`);
  const actions = noGithubActions();
  // Limites curtos por consulta: uma GDELT lenta não pode consumir o prazo inteiro.
  const cliente = criarCliente({ tentativas: 3, esperaBaseMs: 10_000, esperaMaxMs: 30_000, timeoutMs: 20_000 });
  const prazoMs = inteiro(values.prazo, 'prazo', 0) * 60_000;
  const resultados = await executarSpike(alvos, cliente, {
    intervaloMs: opcoes.intervaloMs,
    prazoMs: prazoMs || undefined,
    // No log do Actions, "\r" não reescreve a linha: imprime de 5 em 5.
    aoProgredir: actions
      ? (i) => (i % 5 === 0 || i === alvos.length - 1) && console.log(`${i + 1}/${alvos.length}`)
      : (i) => process.stdout.write(`\r${i + 1}/${alvos.length}`),
  });
  if (!actions) process.stdout.write('\n');

  await mkdir(values.saida, { recursive: true });
  const base = path.join(values.saida, `spike-noticias_${opcoes.hoje}`);
  await writeFile(`${base}.csv`, paraCsv(resultados), 'utf8');
  const resumo = paraResumo(resultados, {
    arquivo: path.basename(values.arquivo),
    semente: opcoes.semente,
    geradoEm: new Date().toISOString(),
  });
  await writeFile(`${base}.md`, resumo, 'utf8');
  console.log(`Gravado: ${base}.csv (para revisar) e ${base}.md (resumo)`);

  if (actions) {
    await escreverResumoExecucao(`${resumo}\n${instrucoesDownload(urlExecucao(), values.artefato)}`);
    for (const comando of anotacoesSpike(resultados)) console.log(comando);
  }
}

main().catch((erro: unknown) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
});
