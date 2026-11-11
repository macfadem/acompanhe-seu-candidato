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
