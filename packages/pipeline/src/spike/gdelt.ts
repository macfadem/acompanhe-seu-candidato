/**
 * Consulta à GDELT DOC 2.0 API (https://api.gdeltproject.org/api/v2/doc/doc).
 * Devolve só metadados das matérias (título, veículo, data, link) — nunca o texto.
 */
import { z } from 'zod';
import type { Parlamentar, Proposicao } from '../tipos.js';

export const GDELT_DOC_API = 'https://api.gdeltproject.org/api/v2/doc/doc';

const ArtigoGdelt = z.object({
  url: z.string(),
  title: z.string().nullish(),
  seendate: z.string().nullish(),
  domain: z.string().nullish(),
});
export const RespostaGdelt = z.object({ articles: z.array(ArtigoGdelt).nullish() });

export interface Materia {
  titulo: string;
  veiculo: string;
  /** ISO 8601 (UTC), a partir do `seendate` da GDELT. */
  data: string | null;
  url: string;
}

export type Janela = { periodo: string } | { inicio: Date; fim: Date };

/** Data no formato da GDELT: AAAAMMDDHHMMSS (UTC). */
export function dataGdelt(d: Date): string {
  return d.toISOString().replace(/[-:T]/g, '').slice(0, 14);
}

export function urlConsultaGdelt(consulta: string, janela: Janela, maxRegistros = 75): string {
  const params = new URLSearchParams({
    query: consulta,
    mode: 'artlist',
    format: 'json',
    maxrecords: String(maxRegistros),
    sort: 'datedesc',
  });
  if ('periodo' in janela) {
    params.set('timespan', janela.periodo);
  } else {
    params.set('startdatetime', dataGdelt(janela.inicio));
    params.set('enddatetime', dataGdelt(janela.fim));
  }
  return `${GDELT_DOC_API}?${params}`;
}

const semAspas = (texto: string) => texto.replace(/"/g, '').trim();

/** Nome entre aspas + cargo, só veículos do Brasil (reduz homônimos). */
export function consultaParlamentar(p: Pick<Parlamentar, 'nome' | 'casa'>): string {
  const cargo = p.casa === 'camara' ? '(deputado OR deputada)' : '(senador OR senadora)';
  return `"${semAspas(p.nome)}" ${cargo} sourcecountry:brazil`;
}

const NOMES_TIPO: Record<string, string[]> = {
  PL: ['projeto de lei'],
  PLP: ['projeto de lei complementar'],
  PEC: ['proposta de emenda à constituição', 'PEC'],
  MPV: ['medida provisória', 'MP'],
  PDL: ['projeto de decreto legislativo'],
};

/** Formas como a imprensa costuma escrever o número: "PL 4133/2023", "PL 4.133/2023", "projeto de lei 4.133"… */
export function variantesNumero(p: Pick<Proposicao, 'sigla' | 'numero' | 'ano'>): string[] {
  const numero = p.numero;
  const comPonto = Number.isFinite(Number(numero)) ? Number(numero).toLocaleString('pt-BR') : numero;
  const formas = new Set<string>();
  const siglas = [p.sigla, ...(p.sigla === 'MPV' ? ['MP'] : [])];
  for (const sigla of siglas) {
    if (p.ano) {
      formas.add(`${sigla} ${numero}/${p.ano}`);
      formas.add(`${sigla} ${comPonto}/${p.ano}`);
    } else {
      formas.add(`${sigla} ${numero}`);
    }
  }
  for (const nome of NOMES_TIPO[p.sigla] ?? []) {
    formas.add(`${nome} ${numero}`);
    formas.add(`${nome} ${comPonto}`);
  }
  return [...formas];
}

export function consultaProposicao(p: Pick<Proposicao, 'sigla' | 'numero' | 'ano'>): string {
  return `(${variantesNumero(p).map((v) => `"${v}"`).join(' OR ')}) sourcecountry:brazil`;
}

/** "20260902T214500Z" → "2026-09-02T21:45:00Z" */
export function dataDoSeendate(seendate: string | null | undefined): string | null {
  const m = seendate ? /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(seendate) : null;
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z` : null;
}

/** Converte a resposta, sem repetir link. */
export function materiasDaResposta(resposta: z.infer<typeof RespostaGdelt>): Materia[] {
  const vistas = new Set<string>();
  const materias: Materia[] = [];
  for (const a of resposta.articles ?? []) {
    if (vistas.has(a.url)) continue;
    vistas.add(a.url);
    materias.push({
      titulo: a.title?.trim() ?? '',
      veiculo: a.domain?.trim() ?? new URL(a.url).hostname,
      data: dataDoSeendate(a.seendate),
      url: a.url,
    });
  }
  return materias;
}
