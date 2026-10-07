import type { Coleta, Parlamentar, Votacao } from './tipos.js';

export function coletaVazia(): Coleta {
  return { votacoes: [], parlamentares: [], votos: [], avisos: [] };
}

/**
 * Junta coletas parciais. Para cada parlamentar fica o registro da votação mais recente
 * (nome, partido e UF podem mudar ao longo do mandato).
 */
export function juntarColetas(...coletas: Coleta[]): Coleta {
  const parlamentares = new Map<string, Parlamentar>();
  const resultado = coletaVazia();
  for (const c of coletas) {
    resultado.votacoes.push(...c.votacoes);
    resultado.votos.push(...c.votos);
    resultado.avisos.push(...c.avisos);
    for (const p of c.parlamentares) {
      const atual = parlamentares.get(p.id);
      if (!atual || p.referenciaData >= atual.referenciaData) parlamentares.set(p.id, p);
    }
  }
  resultado.parlamentares = [...parlamentares.values()];
  return resultado;
}

const porData = (a: Votacao, b: Votacao) =>
  a.data.localeCompare(b.data) ||
  (a.dataHora ?? '').localeCompare(b.dataHora ?? '') ||
  a.id.localeCompare(b.id);

/** Ordem estável (data, hora, id) para que execuções iguais gerem arquivos iguais. */
export function ordenarColeta(coleta: Coleta): Coleta {
  const votacoes = [...coleta.votacoes].sort(porData);
  const posicao = new Map(votacoes.map((v, i) => [v.id, i]));
  const votos = [...coleta.votos].sort(
    (a, b) =>
      (posicao.get(a.votacaoId) ?? 0) - (posicao.get(b.votacaoId) ?? 0) ||
      a.parlamentarId.localeCompare(b.parlamentarId),
  );
  const parlamentares = [...coleta.parlamentares].sort((a, b) => a.id.localeCompare(b.id));
  return { votacoes, votos, parlamentares, avisos: coleta.avisos };
}
