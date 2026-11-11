/**
 * O que o site lê. O modelo é o mesmo do pipeline (packages/pipeline/src/tipos.ts):
 * o app não reinterpreta votos, só mostra o que a coleta normalizou.
 */
import type { Casa, Parlamentar, Votacao, Voto } from '@acompanhe/pipeline/tipos';

export type { Casa, Parlamentar, Votacao, Voto };

export const CASAS = ['camara', 'senado'] as const satisfies readonly Casa[];

export function ehCasa(valor: string): valor is Casa {
  return (CASAS as readonly string[]).includes(valor);
}

/** Um voto do parlamentar junto com a votação a que pertence. */
export interface VotoNaVotacao {
  votacao: Votacao;
  voto: Voto;
}

export interface PaginaDeVotos {
  /** Mais recentes primeiro. */
  itens: VotoNaVotacao[];
  /** Quantos votos o parlamentar tem no total, além dos desta página. */
  total: number;
}

/** Um voto junto com quem votou (na página da votação). */
export interface VotoComParlamentar {
  voto: Voto;
  parlamentar: Parlamentar;
}

export interface DetalheDaVotacao {
  votacao: Votacao;
  /** Em ordem alfabética do nome. */
  votos: VotoComParlamentar[];
}

/** Uma votação da casa do parlamentar e o registro dele nela (`null` = a fonte não traz registro). */
export interface RegistroNaVotacao {
  votacao: Votacao;
  voto: Voto | null;
}

export interface PaginaDeVotacoes {
  /** Mais recentes primeiro. */
  itens: Votacao[];
  total: number;
}

/** De onde vieram os dados — o site mostra isso para quem lê. */
export type OrigemDosDados =
  | { tipo: 'exemplo' }
  | { tipo: 'arquivo'; caminho: string; geradoEm: string | null; intervalo: { de: string; ate: string } | null };

/**
 * Porta de leitura do site. Hoje há uma implementação a partir do arquivo da coleta;
 * a leitura do Supabase entra como outra implementação desta mesma interface.
 */
export interface FonteDeDados {
  readonly origem: OrigemDosDados;
  /** Câmara primeiro; dentro de cada casa, em ordem alfabética. */
  listarParlamentares(): Promise<Parlamentar[]>;
  buscarParlamentar(casa: Casa, idCasa: string): Promise<Parlamentar | null>;
  votosDoParlamentar(parlamentarId: string, opcoes?: { limite?: number }): Promise<PaginaDeVotos>;
  /** Todas as votações da casa do parlamentar, da mais antiga para a mais recente, com o registro dele. */
  registrosDoParlamentar(parlamentarId: string): Promise<RegistroNaVotacao[]>;
  listarVotacoes(opcoes?: { casa?: Casa; limite?: number }): Promise<PaginaDeVotacoes>;
  buscarVotacao(casa: Casa, idCasa: string): Promise<DetalheDaVotacao | null>;
}
