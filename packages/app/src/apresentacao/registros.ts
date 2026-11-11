/**
 * Contas sobre os registros de um parlamentar. Tudo aqui é contagem do que a fonte oficial
 * registra: o site não calcula nota, índice nem ranking.
 */
import { CATEGORIAS_VOTO } from '@acompanhe/pipeline/tipos';
import type { CategoriaVoto, Parlamentar, Votacao, Voto } from '@acompanhe/pipeline/tipos';
import type { RegistroNaVotacao } from '@/fontes/modelo';

/** Como o quadradinho da grade aparece. */
export type GrupoDoRegistro = 'voto' | 'ausencia' | 'outro' | 'sem_registro';

const GRUPO = {
  sim: 'voto',
  nao: 'voto',
  abstencao: 'voto',
  obstrucao: 'voto',
  secreto: 'voto',
  presidente: 'voto',
  presente_sem_voto: 'outro',
  outro: 'outro',
  ausente_justificado: 'ausencia',
  licenca: 'ausencia',
  nao_compareceu: 'ausencia',
} as const satisfies Record<CategoriaVoto, GrupoDoRegistro>;

export function grupoDoRegistro(voto: Pick<Voto, 'categoria'> | null): GrupoDoRegistro {
  return voto === null ? 'sem_registro' : GRUPO[voto.categoria];
}

export const ROTULO_GRUPO = {
  voto: 'Voto ou presidência registrados',
  ausencia: 'Ausência ou licença registrada',
  outro: 'Outro registro',
  sem_registro: 'Sem registro na fonte',
} as const satisfies Record<GrupoDoRegistro, string>;

export interface Resumo {
  /** Votações nominais da casa no período coletado. */
  votacoes: number;
  /** Em quantas delas a fonte traz algum registro deste parlamentar. */
  comRegistro: number;
  porCategoria: Record<CategoriaVoto, number>;
}

export function resumirRegistros(registros: readonly RegistroNaVotacao[]): Resumo {
  const porCategoria = Object.fromEntries(CATEGORIAS_VOTO.map((c) => [c, 0])) as Record<CategoriaVoto, number>;
  let comRegistro = 0;
  for (const { voto } of registros) {
    if (voto === null) continue;
    comRegistro += 1;
    porCategoria[voto.categoria] += 1;
  }
  return { votacoes: registros.length, comRegistro, porCategoria };
}

/** Agrupa por mês ("2026-10"), mantendo a ordem em que os registros chegam. */
export function agruparPorMes<T extends { votacao: Pick<Votacao, 'data'> }>(itens: readonly T[]): { mes: string; itens: T[] }[] {
  const grupos: { mes: string; itens: T[] }[] = [];
  for (const item of itens) {
    const mes = item.votacao.data.slice(0, 7);
    const ultimo = grupos.at(-1);
    if (ultimo?.mes === mes) ultimo.itens.push(item);
    else grupos.push({ mes, itens: [item] });
  }
  return grupos;
}

export interface LinhaEmComum {
  votacao: Votacao;
  /** Um por parlamentar, na ordem recebida; `null` = sem registro ou votação de outra casa. */
  votos: (Voto | null)[];
}

/**
 * Votações em que pelo menos dois dos parlamentares têm registro, da mais recente para a mais
 * antiga. Deputados e senadores não votam nas mesmas sessões: entre casas diferentes não há linha.
 */
export function votacoesEmComum(
  selecionados: readonly { parlamentar: Pick<Parlamentar, 'id'>; registros: readonly RegistroNaVotacao[] }[],
): LinhaEmComum[] {
  const linhas = new Map<string, LinhaEmComum>();
  selecionados.forEach(({ registros }, indice) => {
    for (const { votacao, voto } of registros) {
      if (voto === null) continue;
      let linha = linhas.get(votacao.id);
      if (!linha) {
        linha = { votacao, votos: selecionados.map(() => null) };
        linhas.set(votacao.id, linha);
      }
      linha.votos[indice] = voto;
    }
  });
  return [...linhas.values()]
    .filter((l) => l.votos.filter((v) => v !== null).length >= 2)
    .sort((a, b) => (a.votacao.data === b.votacao.data ? (a.votacao.id < b.votacao.id ? 1 : -1) : a.votacao.data < b.votacao.data ? 1 : -1));
}
