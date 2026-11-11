/**
 * Fonte de dados a partir de um arquivo da coleta (`npm run votacoes`). Serve para
 * desenvolver o site sem banco e para os dados de exemplo. Valida o arquivo inteiro
 * antes de usar: arquivo fora do formato não abre.
 */
import { ColetaLida, conferirReferencias } from './formato';
import type { FonteDeDados, OrigemDosDados, Parlamentar, VotoNaVotacao } from './modelo';

export const LIMITE_PADRAO = 50;

/** Valida o conteúdo de um arquivo da coleta. `descricao` aparece na mensagem de erro. */
export function lerColeta(conteudo: unknown, descricao: string): ColetaLida {
  const r = ColetaLida.safeParse(conteudo);
  if (!r.success) {
    const problemas = r.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join('.') || '(raiz)'}: ${i.message}`)
      .join('; ');
    throw new Error(`${descricao} não está no formato da coleta — ${problemas}`);
  }
  const referencias = conferirReferencias(r.data);
  if (referencias.length > 0) throw new Error(`${descricao} tem referências quebradas — ${referencias.join('; ')}`);
  return r.data;
}

/** Mais recente primeiro: data, depois hora (sem hora vai por último no dia), depois id. */
export function compararMaisRecentePrimeiro(a: VotoNaVotacao, b: VotoNaVotacao): number {
  const va = a.votacao;
  const vb = b.votacao;
  if (va.data !== vb.data) return va.data < vb.data ? 1 : -1;
  if (va.dataHora !== vb.dataHora) {
    if (va.dataHora === null) return 1;
    if (vb.dataHora === null) return -1;
    return va.dataHora < vb.dataHora ? 1 : -1;
  }
  return va.id < vb.id ? 1 : va.id > vb.id ? -1 : 0;
}

const ordemDaCasa = { camara: 0, senado: 1 } as const;

export function criarFonteDaColeta(coleta: ColetaLida, origem: OrigemDosDados): FonteDeDados {
  const porId = new Map(coleta.parlamentares.map((p) => [p.id, p]));
  const votacoes = new Map(coleta.votacoes.map((v) => [v.id, v]));

  const votosPorParlamentar = new Map<string, VotoNaVotacao[]>();
  for (const voto of coleta.votos) {
    const votacao = votacoes.get(voto.votacaoId);
    if (!votacao) continue; // lerColeta já recusa referência quebrada
    const lista = votosPorParlamentar.get(voto.parlamentarId) ?? [];
    lista.push({ votacao, voto });
    votosPorParlamentar.set(voto.parlamentarId, lista);
  }
  for (const lista of votosPorParlamentar.values()) lista.sort(compararMaisRecentePrimeiro);

  const ordenados: Parlamentar[] = [...coleta.parlamentares].sort(
    (a, b) => ordemDaCasa[a.casa] - ordemDaCasa[b.casa] || a.nome.localeCompare(b.nome, 'pt-BR'),
  );

  return {
    origem,
    async listarParlamentares() {
      return ordenados;
    },
    async buscarParlamentar(casa, idCasa) {
      return porId.get(`${casa}:${idCasa}`) ?? null;
    },
    async votosDoParlamentar(parlamentarId, { limite = LIMITE_PADRAO } = {}) {
      if (!Number.isInteger(limite) || limite < 1) throw new RangeError(`limite inválido: ${limite}`);
      const todos = votosPorParlamentar.get(parlamentarId) ?? [];
      return { itens: todos.slice(0, limite), total: todos.length };
    },
  };
}
