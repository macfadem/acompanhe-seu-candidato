import { z } from 'zod';
import { somarDias } from '../datas.js';
import { anotacao } from '../github.js';
import { type ClienteHttp, ErroHttp } from '../http.js';
import type { Parlamentar, Votacao } from '../tipos.js';
import { validar } from '../validar.js';
import { amostrarParlamentares, amostrarVotacoes } from './amostra.js';
import {
  consultaParlamentar,
  consultaProposicao,
  type Janela,
  type Materia,
  materiasDaResposta,
  RespostaGdelt,
  urlConsultaGdelt,
} from './gdelt.js';

/** O arquivo gerado por `npm run votacoes` (só os campos usados aqui). */
export const ArquivoColeta = z.object({
  parlamentares: z.array(
    z.object({
      id: z.string(),
      casa: z.enum(['camara', 'senado']),
      idCasa: z.string(),
      nome: z.string(),
      partido: z.string().nullable(),
      uf: z.string().nullable(),
      referenciaData: z.string(),
    }),
  ),
  votacoes: z.array(
    z.object({
      id: z.string(),
      casa: z.enum(['camara', 'senado']),
      idCasa: z.string(),
      data: z.string(),
      dataHora: z.string().nullable(),
      orgao: z.string(),
      descricao: z.string(),
      resultado: z.enum(['aprovada', 'rejeitada', 'indefinido']),
      secreta: z.boolean(),
      nominal: z.boolean(),
      proposicao: z
        .object({
          sigla: z.string(),
          numero: z.string(),
          ano: z.number().nullable(),
          ementa: z.string().nullable(),
          idCasa: z.string().nullable(),
          url: z.string().nullable(),
        })
        .nullable(),
      placar: z.object({ sim: z.number(), nao: z.number(), abstencao: z.number() }).nullable(),
      urlFonte: z.string(),
      urlApi: z.string(),
    }),
  ),
});

export interface Alvo {
  tipo: 'parlamentar' | 'votacao';
  rotulo: string;
  casa: 'camara' | 'senado';
  uf: string | null;
  partido: string | null;
  consulta: string;
  janela: Janela;
}

export interface ResultadoAlvo {
  alvo: Alvo;
  materias: Materia[];
  erro: string | null;
}

export interface OpcoesSpike {
  semente: number;
  deputados: number;
  senadores: number;
  votacoes: number;
  /** Pausa entre consultas, para não sobrecarregar a GDELT. */
  intervaloMs: number;
  /** Data de hoje (AAAA-MM-DD); a GDELT só busca votações recentes. */
  hoje: string;
}

const CASA = { camara: 'Câmara', senado: 'Senado' } as const;

function alvoParlamentar(p: Parlamentar): Alvo {
  return {
    tipo: 'parlamentar',
    rotulo: `${p.nome} (${p.partido ?? '?'}-${p.uf ?? '?'})`,
    casa: p.casa,
    uf: p.uf,
    partido: p.partido,
    consulta: consultaParlamentar(p),
    janela: { periodo: '3m' },
  };
}

function alvoVotacao(v: Votacao): Alvo | null {
  if (!v.proposicao) return null;
  const { sigla, numero, ano } = v.proposicao;
  const inicio = new Date(`${somarDias(v.data, -1)}T00:00:00Z`);
  const fim = new Date(`${somarDias(v.data, 2)}T00:00:00Z`);
  return {
    tipo: 'votacao',
    rotulo: `${sigla} ${numero}${ano ? `/${ano}` : ''} — ${CASA[v.casa]}, ${v.data}`,
    casa: v.casa,
    uf: null,
    partido: null,
    consulta: consultaProposicao(v.proposicao),
    janela: { inicio, fim },
  };
}

/** Monta a lista de alvos: amostra de deputados, de senadores e de votações recentes. */
export function montarAlvos(coleta: z.infer<typeof ArquivoColeta>, opcoes: OpcoesSpike): Alvo[] {
  const criterios = { maxPorUf: 2, maxPorPartido: 3 };
  const deputados = amostrarParlamentares(
    coleta.parlamentares.filter((p) => p.casa === 'camara'),
    { ...criterios, tamanho: opcoes.deputados },
    opcoes.semente,
  );
  const senadores = amostrarParlamentares(
    coleta.parlamentares.filter((p) => p.casa === 'senado'),
    { ...criterios, tamanho: opcoes.senadores },
    opcoes.semente,
  );
  // A GDELT busca nos últimos ~3 meses: só entram votações dessa janela.
  const votacoes = amostrarVotacoes(coleta.votacoes, opcoes.votacoes, opcoes.semente, somarDias(opcoes.hoje, -85));
  return [
    ...deputados.map(alvoParlamentar),
    ...senadores.map(alvoParlamentar),
    ...votacoes.flatMap((v) => alvoVotacao(v) ?? []),
  ];
}

/** Mensagem curta para a tabela (sem a URL inteira). */
function descreverErro(erro: unknown): string {
  if (erro instanceof ErroHttp) return `HTTP ${erro.status}`;
  const texto = erro instanceof Error ? (erro.message.split('\n')[0] ?? 'erro') : String(erro);
  return texto.replace(/ em https?:\/\/\S+/, '').slice(0, 120);
}

/** Uma consulta por vez, com pausa; erro numa consulta não interrompe as outras. */
export async function executarSpike(
  alvos: readonly Alvo[],
  cliente: ClienteHttp,
  opcoes: Pick<OpcoesSpike, 'intervaloMs'> & {
    esperar?: (ms: number) => Promise<void>;
    aoProgredir?: (i: number) => void;
    /** Tempo máximo de consultas; os alvos que sobrarem ficam registrados como não consultados. */
    prazoMs?: number;
    agora?: () => number;
  },
): Promise<ResultadoAlvo[]> {
  const esperar = opcoes.esperar ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const agora = opcoes.agora ?? Date.now;
  const limite = opcoes.prazoMs ? agora() + opcoes.prazoMs : Number.POSITIVE_INFINITY;
  const resultados: ResultadoAlvo[] = [];
  for (const [i, alvo] of alvos.entries()) {
    if (agora() >= limite) {
      resultados.push({ alvo, materias: [], erro: 'não consultado: prazo esgotado' });
      continue;
    }
    if (i > 0) await esperar(opcoes.intervaloMs);
    opcoes.aoProgredir?.(i);
    try {
      const resposta = validar(RespostaGdelt, (await cliente.getJson(urlConsultaGdelt(alvo.consulta, alvo.janela))) ?? {}, 'GDELT');
      resultados.push({ alvo, materias: materiasDaResposta(resposta), erro: null });
    } catch (erro) {
      resultados.push({ alvo, materias: [], erro: descreverErro(erro) });
    }
  }
  return resultados;
}

// --- Saídas ---

function celula(valor: string | null): string {
  const texto = valor ?? '';
  return /[;"\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** CSV (separador ";", com BOM) para revisar à mão: uma linha por matéria. */
export function paraCsv(resultados: readonly ResultadoAlvo[]): string {
  const cabecalho = ['tipo', 'alvo', 'casa', 'uf', 'partido', 'titulo', 'veiculo', 'data', 'url', 'relevante', 'homonimo'];
  const linhas = [cabecalho.join(';')];
  for (const { alvo, materias } of resultados) {
    for (const m of materias) {
      linhas.push(
        [alvo.tipo, alvo.rotulo, alvo.casa, alvo.uf, alvo.partido, m.titulo, m.veiculo, m.data, m.url, '', '']
          .map(celula)
          .join(';'),
      );
    }
  }
  return `﻿${linhas.join('\n')}\n`;
}

const pct = (parte: number, total: number) => (total === 0 ? '—' : `${Math.round((100 * parte) / total)}%`);

export interface Cobertura {
  parlamentares: { com: number; total: number };
  votacoes: { com: number; total: number };
  erros: number;
  /** Matérias por veículo, do mais frequente para o menos. */
  veiculos: [string, number][];
}

/** Números brutos do spike (antes da revisão manual), usados no resumo e nas anotações. */
export function cobertura(resultados: readonly ResultadoAlvo[]): Cobertura {
  const contar = (tipo: Alvo['tipo']) => {
    const rs = resultados.filter((r) => r.alvo.tipo === tipo);
    return { com: rs.filter((r) => r.materias.length > 0).length, total: rs.length };
  };
  const veiculos = new Map<string, number>();
  for (const r of resultados) for (const m of r.materias) veiculos.set(m.veiculo, (veiculos.get(m.veiculo) ?? 0) + 1);
  return {
    parlamentares: contar('parlamentar'),
    votacoes: contar('votacao'),
    erros: resultados.filter((r) => r.erro).length,
    veiculos: [...veiculos].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
  };
}

const veiculosDistintos = (r: ResultadoAlvo) => new Set(r.materias.map((m) => m.veiculo)).size;

/** Resumo em Markdown com cobertura, veículos e o critério de decisão do roadmap. */
export function paraResumo(
  resultados: readonly ResultadoAlvo[],
  meta: { arquivo: string; semente: number; geradoEm: string },
): string {
  const linhas: string[] = [];
  const c = cobertura(resultados);
  const principais = c.veiculos.slice(0, 15);

  linhas.push('# Spike de notícias — GDELT', '');
  linhas.push(`Gerado em ${meta.geradoEm} a partir de \`${meta.arquivo}\` (semente ${meta.semente}).`, '');
  linhas.push('## Resultado bruto (antes da revisão manual)', '');
  linhas.push(`- Parlamentares com pelo menos 1 matéria: ${c.parlamentares.com} de ${c.parlamentares.total} (${pct(c.parlamentares.com, c.parlamentares.total)})`);
  linhas.push(`- Votações com pelo menos 1 matéria citando o número: ${c.votacoes.com} de ${c.votacoes.total} (${pct(c.votacoes.com, c.votacoes.total)})`);
  linhas.push(`- Consultas com erro: ${c.erros}`);
  linhas.push(`- Veículos distintos: ${c.veiculos.length}${principais.length ? ` — mais frequentes: ${principais.map(([v, n]) => `${v} (${n})`).join(', ')}` : ''}`, '');
  linhas.push('## Por alvo', '', '| Alvo | Matérias | Veículos | Erro |', '|---|---|---|---|');
  for (const r of resultados) {
    linhas.push(`| ${r.alvo.rotulo.replace(/\|/g, '\\|')} | ${r.materias.length} | ${veiculosDistintos(r)} | ${r.erro ?? ''} |`);
  }
  linhas.push('', '## Como avaliar', '');
  linhas.push('1. Abra o CSV e preencha, em cada linha, `relevante` (s/n) e `homonimo` (s/n).');
  linhas.push('2. Critério do roadmap: a fonte serve se achar matéria relevante para ≥ 70% dos parlamentares e ≥ 80% das votações com cobertura evidente, com ≤ 10% de linhas de homônimos.');
  linhas.push('3. Votações sem nenhuma matéria pelo número indicam que a regra de destaque vai precisar de termos da ementa, não só do número.');
  return `${linhas.join('\n')}\n`;
}

/**
 * Anotações para a página da execução no GitHub Actions: os totais, a cobertura de cada
 * alvo (uma anotação por grupo, porque o GitHub mostra no máximo 10 por nível) e os erros.
 */
export function anotacoesSpike(resultados: readonly ResultadoAlvo[]): string[] {
  const c = cobertura(resultados);
  const saida = [
    anotacao(
      'notice',
      [
        `Parlamentares com matéria: ${c.parlamentares.com} de ${c.parlamentares.total} (${pct(c.parlamentares.com, c.parlamentares.total)})`,
        `Votações com matéria citando o número: ${c.votacoes.com} de ${c.votacoes.total} (${pct(c.votacoes.com, c.votacoes.total)})`,
        `Veículos distintos: ${c.veiculos.length} · consultas com erro: ${c.erros}`,
      ].join('\n'),
      'Spike de notícias — cobertura bruta',
    ),
  ];
  const linha = (r: ResultadoAlvo) =>
    `${r.materias.length} matéria(s), ${veiculosDistintos(r)} veículo(s) — ${r.alvo.rotulo}${r.erro ? ` [erro: ${r.erro}]` : ''}`;
  for (const [tipo, titulo] of [
    ['parlamentar', 'Cobertura por parlamentar'],
    ['votacao', 'Cobertura por votação'],
  ] as const) {
    const grupo = resultados.filter((r) => r.alvo.tipo === tipo);
    if (grupo.length > 0) saida.push(anotacao('notice', grupo.map(linha).join('\n'), `${titulo} (${grupo.length})`));
  }
  const comErro = resultados.filter((r) => r.erro);
  if (comErro.length > 0) {
    saida.push(
      anotacao('warning', comErro.map((r) => `${r.alvo.rotulo}: ${r.erro}`).join('\n'), `Consultas à GDELT com erro (${comErro.length})`),
    );
  }
  return saida;
}

/** Como baixar a planilha, para o fim do resumo da execução. */
export function instrucoesDownload(urlDaExecucao: string | null, artefato: string): string {
  const onde = urlDaExecucao ? `[página desta execução](${urlDaExecucao})` : 'página desta execução';
  return [
    '## Como baixar a planilha',
    '',
    `1. Na ${onde}, role até **Artifacts** e baixe \`${artefato}\` (um .zip com o CSV e este resumo; fica guardado por 30 dias).`,
    '2. O CSV usa ";" e vem com BOM: abre direto no Excel em português. No Google Planilhas: Arquivo → Importar → separador "Ponto e vírgula".',
    `3. Pelo terminal: \`gh run download ${urlDaExecucao?.split('/').pop() ?? '<id-da-execução>'} -n ${artefato} -R macfadem/acompanhe-seu-candidato\`.`,
    '',
  ].join('\n');
}
