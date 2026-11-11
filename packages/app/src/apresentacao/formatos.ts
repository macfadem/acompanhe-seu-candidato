import type { Parlamentar, Placar, Votacao } from '@acompanhe/pipeline/tipos';

/**
 * "2026-06-01" → "01/06/2026". Trabalha só com o texto, de propósito: `new Date('2026-06-01')`
 * é meia-noite UTC, que no horário de Brasília ainda é o dia anterior.
 */
export function formatarData(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`data fora do formato AAAA-MM-DD: ${iso}`);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Título curto: "PL 9001/2026" ou, se a coleta não identificou a proposição, a descrição. */
export function tituloDaVotacao(votacao: Votacao): string {
  const p = votacao.proposicao;
  if (!p) return votacao.descricao;
  return p.ano === null ? `${p.sigla} ${p.numero}` : `${p.sigla} ${p.numero}/${p.ano}`;
}

export function formatarPlacar(placar: Placar): string {
  return `Sim ${placar.sim}, Não ${placar.nao}, Abstenção ${placar.abstencao}`;
}

/** "PEX-MG", "PEX", "MG" ou "Sem partido informado". */
export function partidoUf(partido: string | null, uf: string | null): string {
  if (partido && uf) return `${partido}-${uf}`;
  return partido ?? uf ?? 'Sem partido informado';
}

export function caminhoDoParlamentar(p: Pick<Parlamentar, 'casa' | 'idCasa'>): string {
  return `/parlamentar/${p.casa}/${encodeURIComponent(p.idCasa)}`;
}

/** Frase sobre quantos votos a página mostra; vazia quando não há nenhum. */
export function descreverContagem(mostrados: number, total: number): string {
  if (total === 0) return '';
  if (mostrados < total) return `As ${mostrados} mais recentes de ${total} votações no período coletado.`;
  return total === 1 ? '1 votação no período coletado.' : `${total} votações no período coletado.`;
}

export function caminhoDaVotacao(v: Pick<Votacao, 'casa' | 'idCasa'>): string {
  return `/votacao/${v.casa}/${encodeURIComponent(v.idCasa)}`;
}

export function caminhoDaUf(uf: string): string {
  return `/uf/${uf.toLowerCase()}`;
}

export const MAXIMO_PARA_COMPARAR = 5;

/** Ids válidos ("camara:123"), sem repetição, no máximo 5, na ordem em que vieram. */
export function lerIdsParaComparar(valor: string | string[] | undefined): string[] {
  const lista = valor === undefined ? [] : Array.isArray(valor) ? valor : [valor];
  const validos = lista.filter((id) => /^(camara|senado):\d{1,12}$/.test(id));
  return [...new Set(validos)].slice(0, MAXIMO_PARA_COMPARAR);
}

/** "/comparar?p=camara:1&p=senado:2" (e "&q=..." quando há busca em andamento). */
export function caminhoDeComparar(ids: readonly string[], busca?: string): string {
  const params = new URLSearchParams();
  for (const id of ids) params.append('p', id);
  if (busca) params.set('q', busca);
  const query = params.toString();
  return query ? `/comparar?${query}` : '/comparar';
}

/** "Ana Maria Exemplo" → "AE"; um nome só → a primeira letra. */
export function iniciais(nome: string): string {
  const palavras = nome.trim().split(/\s+/).filter(Boolean);
  const primeira = palavras[0]?.[0] ?? '';
  const ultima = palavras.length > 1 ? (palavras.at(-1)?.[0] ?? '') : '';
  return (primeira + ultima).toLocaleUpperCase('pt-BR');
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const;

/** "2026-10" → "out/2026". */
export function formatarMes(anoMes: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(anoMes);
  const nome = m ? MESES[Number(m[2]) - 1] : undefined;
  if (!m || !nome) throw new Error(`mês fora do formato AAAA-MM: ${anoMes}`);
  return `${nome}/${m[1]}`;
}

export function plural(n: number, um: string, varios: string): string {
  return n === 1 ? `1 ${um}` : `${n} ${varios}`;
}
