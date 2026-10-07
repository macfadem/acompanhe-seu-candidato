/**
 * Amostras reprodutíveis e diversas, sem ninguém escolher nomes à mão
 * (regra de neutralidade): ordena por id, embaralha com semente fixa e
 * respeita limites por UF e por partido.
 */
import type { Parlamentar, Votacao } from '../tipos.js';

/** Gerador pseudoaleatório determinístico (mulberry32): a mesma semente gera a mesma sequência. */
export function geradorAleatorio(semente: number): () => number {
  let estado = semente >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates numa cópia. */
export function embaralhar<T>(itens: readonly T[], aleatorio: () => number): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    const temp = copia[i] as T;
    copia[i] = copia[j] as T;
    copia[j] = temp;
  }
  return copia;
}

export interface CriteriosAmostra {
  tamanho: number;
  maxPorUf: number;
  maxPorPartido: number;
}

export function amostrarParlamentares(
  parlamentares: readonly Parlamentar[],
  criterios: CriteriosAmostra,
  semente: number,
): Parlamentar[] {
  const ordenados = [...parlamentares].sort((a, b) => a.id.localeCompare(b.id));
  const porUf = new Map<string, number>();
  const porPartido = new Map<string, number>();
  const escolhidos: Parlamentar[] = [];
  for (const p of embaralhar(ordenados, geradorAleatorio(semente))) {
    if (escolhidos.length >= criterios.tamanho) break;
    const uf = p.uf ?? '?';
    const partido = p.partido ?? '?';
    if ((porUf.get(uf) ?? 0) >= criterios.maxPorUf) continue;
    if ((porPartido.get(partido) ?? 0) >= criterios.maxPorPartido) continue;
    escolhidos.push(p);
    porUf.set(uf, (porUf.get(uf) ?? 0) + 1);
    porPartido.set(partido, (porPartido.get(partido) ?? 0) + 1);
  }
  return escolhidos;
}

/**
 * Uma votação nominal de plenário por proposição (a mais recente), a partir de `desde`,
 * sorteada com a mesma regra.
 */
export function amostrarVotacoes(
  votacoes: readonly Votacao[],
  tamanho: number,
  semente: number,
  desde: string,
): Votacao[] {
  const porProposicao = new Map<string, Votacao>();
  for (const v of votacoes) {
    if (!v.nominal || v.orgao !== 'PLEN' || !v.proposicao || v.data < desde) continue;
    const chave = `${v.casa}:${v.proposicao.sigla}:${v.proposicao.numero}:${v.proposicao.ano ?? ''}`;
    const atual = porProposicao.get(chave);
    if (!atual || v.data > atual.data) porProposicao.set(chave, v);
  }
  const ordenadas = [...porProposicao.values()].sort((a, b) => a.id.localeCompare(b.id));
  return embaralhar(ordenadas, geradorAleatorio(semente)).slice(0, tamanho);
}
