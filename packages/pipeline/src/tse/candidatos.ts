/**
 * Candidatos do TSE 2026 (consulta_cand_2026_BRASIL.csv, dentro de consulta_cand_2026.zip):
 * deputados federais e senadores, com a situação da totalização. O leitor é guiado pelo
 * cabeçalho — a ordem das colunas pode mudar; uma coluna obrigatória ausente é erro.
 *
 * Privacidade: o arquivo traz CPF, título de eleitor, e-mail, data de nascimento, gênero,
 * cor/raça, estado civil e grau de instrução. Só as colunas de COLUNAS_OBRIGATORIAS (e o
 * nome social, quando houver) são lidas; as outras nunca saem da linha bruta. Quem tem nome
 * social é identificado por ele: o nome de registro dessa pessoa não é guardado.
 *
 * Fonte: TSE — Portal de Dados Abertos (CC-BY).
 */
import { ErroFormato } from '../validar.js';
import { linhasCsv } from './csv.js';

export const FONTE_TSE = 'Fonte: TSE — Portal de Dados Abertos (https://dadosabertos.tse.jus.br/dataset/candidatos-2026), licença CC-BY';

/** Colunas lidas (cabeçalho real de 07/10/2026, conferido no GitHub Actions). */
export const COLUNAS_OBRIGATORIAS = [
  'DT_GERACAO',
  'HH_GERACAO',
  'ANO_ELEICAO',
  'NR_TURNO',
  'SG_UF',
  'CD_CARGO',
  'DS_CARGO',
  'SQ_CANDIDATO',
  'NR_CANDIDATO',
  'NM_CANDIDATO',
  'NM_URNA_CANDIDATO',
  'SG_PARTIDO',
  'SG_FEDERACAO',
  'CD_SIT_TOT_TURNO',
  'DS_SIT_TOT_TURNO',
] as const;
type Coluna = (typeof COLUNAS_OBRIGATORIAS)[number];

export type CargoTse = 'deputado_federal' | 'senador';

/** CD_CARGO → cargo do MVP, com o DS_CARGO esperado para conferência. */
const CARGOS: Record<string, { cargo: CargoTse; descricao: string }> = {
  '6': { cargo: 'deputado_federal', descricao: 'DEPUTADO FEDERAL' },
  '5': { cargo: 'senador', descricao: 'SENADOR' },
};

/** CD_SIT_TOT_TURNO → DS_SIT_TOT_TURNO (vistos no arquivo de 07/10/2026). -1 = #NULO: sem totalização. */
export const SITUACOES_TOTALIZACAO: Record<number, string> = {
  1: 'ELEITO',
  2: 'ELEITO POR QP',
  3: 'ELEITO POR MÉDIA',
  4: 'NÃO ELEITO',
  5: 'SUPLENTE',
  6: '2º TURNO',
};

export interface CandidatoTse {
  sqCandidato: string;
  ano: number;
  cargo: CargoTse;
  uf: string;
  numero: number;
  nomeUrna: string;
  /** Nome social, quando informado ao TSE; senão o nome civil. Usado no vínculo com Câmara/Senado. */
  nomeCivil: string;
  partido: string;
  federacao: string | null;
  cdSituacaoTotalizacao: number | null;
  situacaoTotalizacao: string | null;
  /** AAAA-MM-DDTHH:mm:ss (Brasília), da geração do arquivo. */
  geradoEmTse: string;
}

export type TipoAvisoTse =
  | 'linha_invalida'
  | 'cargo_divergente'
  | 'turno_inesperado'
  | 'situacao_desconhecida'
  | 'situacao_divergente'
  | 'candidato_repetido';

export interface AvisoTse {
  tipo: TipoAvisoTse;
  detalhe: string;
}

export interface LeituraCandidatos {
  candidatos: CandidatoTse[];
  avisos: AvisoTse[];
  linhas: number;
  /** Linhas de outros cargos ou anos (ignoradas de propósito). */
  foraDoEscopo: number;
}

const NULOS = new Set(['', '#NULO', '#NE', '#NULO#']);
const nulo = (valor: string) => (NULOS.has(valor.trim()) ? null : valor.trim());

function dataHoraGeracao(data: string, hora: string): string | null {
  const d = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(data.trim());
  const h = /^(\d{2}):(\d{2}):(\d{2})$/.exec(hora.trim());
  return d && h ? `${d[3]}-${d[2]}-${d[1]}T${h[1]}:${h[2]}:${h[3]}` : null;
}

/** Lê o CSV (já decodificado de Latin-1) e devolve só deputados federais e senadores do ano pedido. */
export function lerCandidatos(texto: string, ano = 2026): LeituraCandidatos {
  const linhas = linhasCsv(texto.replace(/^﻿/, ''));
  const primeira = linhas.next();
  if (primeira.done) throw new ErroFormato('Arquivo de candidatos vazio.');
  const cabecalho = primeira.value.map((c) => c.trim());
  const ausentes = COLUNAS_OBRIGATORIAS.filter((c) => !cabecalho.includes(c));
  if (ausentes.length > 0) {
    throw new ErroFormato(
      `Arquivo de candidatos sem colunas obrigatórias: ${ausentes.join(', ')}. O TSE pode ter mudado o formato — confira o leiame.pdf do zip.`,
    );
  }
  const indice = Object.fromEntries(COLUNAS_OBRIGATORIAS.map((c) => [c, cabecalho.indexOf(c)])) as Record<Coluna, number>;
  // Opcional: quem informou nome social ao TSE é identificado por ele (nunca pelo nome de registro).
  const iNomeSocial = cabecalho.indexOf('NM_SOCIAL_CANDIDATO');

  const avisos: AvisoTse[] = [];
  const porSq = new Map<string, CandidatoTse>();
  let total = 0;
  let foraDoEscopo = 0;
  const avisar = (tipo: TipoAvisoTse, detalhe: string) => avisos.push({ tipo, detalhe });

  for (const campos of linhas) {
    total += 1;
    const numeroLinha = total + 1; // conta o cabeçalho
    if (campos.length !== cabecalho.length) {
      avisar('linha_invalida', `linha ${numeroLinha}: ${campos.length} campos (o cabeçalho tem ${cabecalho.length})`);
      continue;
    }
    const v = (c: Coluna) => campos[indice[c]]!.trim();

    const definicao = CARGOS[v('CD_CARGO')];
    if (!definicao || Number(v('ANO_ELEICAO')) !== ano) {
      foraDoEscopo += 1;
      continue;
    }
    const sq = v('SQ_CANDIDATO');
    if (v('DS_CARGO') !== definicao.descricao) {
      avisar('cargo_divergente', `SQ ${sq}: CD_CARGO ${v('CD_CARGO')} com DS_CARGO "${v('DS_CARGO')}" — ignorado`);
      continue;
    }
    if (v('NR_TURNO') !== '1') {
      avisar('turno_inesperado', `SQ ${sq}: NR_TURNO ${v('NR_TURNO')} para ${definicao.descricao} — ignorado`);
      continue;
    }

    const numero = Number(v('NR_CANDIDATO'));
    const uf = v('SG_UF');
    const geradoEmTse = dataHoraGeracao(v('DT_GERACAO'), v('HH_GERACAO'));
    const nomeUrna = v('NM_URNA_CANDIDATO');
    const nomeCivil = (iNomeSocial >= 0 ? nulo(campos[iNomeSocial] ?? '') : null) ?? v('NM_CANDIDATO');
    const partido = v('SG_PARTIDO');
    const problemas = [
      !/^\d+$/.test(sq) && 'SQ_CANDIDATO',
      !(Number.isInteger(numero) && numero > 0) && 'NR_CANDIDATO',
      !/^[A-Z]{2}$/.test(uf) && 'SG_UF',
      !geradoEmTse && 'DT_GERACAO/HH_GERACAO',
      !nulo(nomeUrna) && 'NM_URNA_CANDIDATO',
      !nulo(nomeCivil) && 'NM_CANDIDATO',
      !nulo(partido) && 'SG_PARTIDO',
    ].filter(Boolean);
    if (problemas.length > 0) {
      avisar('linha_invalida', `linha ${numeroLinha} (SQ ${sq || '?'}): campo(s) inválido(s): ${problemas.join(', ')}`);
      continue;
    }

    const cd = Number(v('CD_SIT_TOT_TURNO'));
    const ds = nulo(v('DS_SIT_TOT_TURNO'));
    let cdSituacao: number | null = null;
    let situacao: string | null = null;
    if (cd === -1 || (!ds && !Number.isInteger(cd))) {
      // Sem totalização (#NULO): ex. candidatura indeferida ou renúncia. Mantém o candidato, sem situação.
    } else if (!Number.isInteger(cd) || !ds) {
      avisar('situacao_desconhecida', `SQ ${sq}: CD_SIT_TOT_TURNO "${v('CD_SIT_TOT_TURNO')}" com DS_SIT_TOT_TURNO "${v('DS_SIT_TOT_TURNO')}"`);
    } else {
      cdSituacao = cd;
      situacao = ds;
      const esperado = SITUACOES_TOTALIZACAO[cd];
      if (!esperado) avisar('situacao_desconhecida', `código novo ${cd} = "${ds}" (SQ ${sq})`);
      else if (esperado !== ds) avisar('situacao_divergente', `código ${cd} veio como "${ds}" (esperado "${esperado}"; SQ ${sq})`);
    }

    const candidato: CandidatoTse = {
      sqCandidato: sq,
      ano,
      cargo: definicao.cargo,
      uf,
      numero,
      nomeUrna,
      nomeCivil,
      partido,
      federacao: nulo(v('SG_FEDERACAO')),
      cdSituacaoTotalizacao: cdSituacao,
      situacaoTotalizacao: situacao,
      geradoEmTse: geradoEmTse!,
    };
    const anterior = porSq.get(sq);
    if (anterior) {
      if (JSON.stringify(anterior) !== JSON.stringify(candidato)) {
        avisar('candidato_repetido', `SQ ${sq} aparece mais de uma vez com dados diferentes — mantida a primeira`);
      }
      continue;
    }
    porSq.set(sq, candidato);
  }
  return { candidatos: [...porSq.values()], avisos: resumirAvisos(avisos), linhas: total, foraDoEscopo };
}

/** Até 5 avisos detalhados por tipo; o resto vira uma linha de contagem. */
function resumirAvisos(avisos: readonly AvisoTse[], maximo = 5): AvisoTse[] {
  const porTipo = new Map<TipoAvisoTse, AvisoTse[]>();
  for (const a of avisos) porTipo.set(a.tipo, [...(porTipo.get(a.tipo) ?? []), a]);
  return [...porTipo].flatMap(([tipo, lista]) =>
    lista.length <= maximo ? lista : [...lista.slice(0, maximo), { tipo, detalhe: `… e mais ${lista.length - maximo}` }],
  );
}

// --- Resumo (só contagens; nenhum dado pessoal) ---

const NOME_CARGO: Record<CargoTse, string> = { deputado_federal: 'Deputado federal', senador: 'Senador' };
const ELEITO = new Set([1, 2, 3]);

export function contarPorSituacao(candidatos: readonly CandidatoTse[], cargo: CargoTse): Array<[string, number]> {
  const contagem = new Map<string, number>();
  for (const c of candidatos) {
    if (c.cargo !== cargo) continue;
    const chave = c.situacaoTotalizacao ?? 'sem totalização (#NULO)';
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
  }
  return [...contagem].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** Markdown para a página da execução: por cargo e situação, e por UF. */
export function resumoCandidatos(leitura: LeituraCandidatos): string {
  const { candidatos } = leitura;
  const linhas = ['## Candidatos do TSE 2026', ''];
  linhas.push(
    `${candidatos.length} candidaturas de deputado federal e senador (de ${leitura.linhas} linhas; ${leitura.foraDoEscopo} de outros cargos ignoradas).`,
    '',
  );
  for (const cargo of ['deputado_federal', 'senador'] as const) {
    linhas.push(`### ${NOME_CARGO[cargo]}`, '', '| Situação da totalização | Candidaturas |', '|---|---|');
    for (const [situacao, n] of contarPorSituacao(candidatos, cargo)) linhas.push(`| ${situacao} | ${n} |`);
    linhas.push('');
  }
  const ufs = [...new Set(candidatos.map((c) => c.uf))].sort();
  linhas.push('### Por UF', '', '| UF | Dep. federal (eleitos / total) | Senador (eleitos / total) |', '|---|---|---|');
  for (const uf of ufs) {
    const celula = (cargo: CargoTse) => {
      const doCargo = candidatos.filter((c) => c.uf === uf && c.cargo === cargo);
      const eleitos = doCargo.filter((c) => c.cdSituacaoTotalizacao !== null && ELEITO.has(c.cdSituacaoTotalizacao)).length;
      return `${eleitos} / ${doCargo.length}`;
    };
    linhas.push(`| ${uf} | ${celula('deputado_federal')} | ${celula('senador')} |`);
  }
  linhas.push('');
  if (leitura.avisos.length > 0) {
    linhas.push('### Avisos', '', ...leitura.avisos.map((a) => `- \`${a.tipo}\`: ${a.detalhe}`), '');
  }
  linhas.push(`_${FONTE_TSE}._`, '');
  return linhas.join('\n');
}

/** Eleitos por cargo (para conferência: 513 deputados federais e 54 senadores em 2026). */
export function contarEleitos(candidatos: readonly CandidatoTse[]): Record<CargoTse, number> {
  const eleitos = { deputado_federal: 0, senador: 0 };
  for (const c of candidatos) if (c.cdSituacaoTotalizacao !== null && ELEITO.has(c.cdSituacaoTotalizacao)) eleitos[c.cargo] += 1;
  return eleitos;
}
