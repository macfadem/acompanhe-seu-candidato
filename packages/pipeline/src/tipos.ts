/**
 * Modelo normalizado das votações. É o mesmo para Câmara e Senado, para que o app
 * trate todos os parlamentares do mesmo jeito (regra de neutralidade do projeto).
 */

export type Casa = 'camara' | 'senado';

/** Categorias neutras de voto. O valor original da fonte é sempre guardado junto. */
export const CATEGORIAS_VOTO = [
  'sim',
  'nao',
  'abstencao',
  'obstrucao',
  'ausente_justificado', // atividade parlamentar ou missão oficial
  'licenca', // licença saúde, particular, paternidade etc.
  'presente_sem_voto', // presente, mas não registrou voto
  'presidente', // presidindo a sessão
  'secreto', // votou em votação secreta: a escolha não é pública
  'outro', // código ainda não mapeado — sempre gera aviso
] as const;
export type CategoriaVoto = (typeof CATEGORIAS_VOTO)[number];

export type Resultado = 'aprovada' | 'rejeitada' | 'indefinido';

export interface Proposicao {
  /** Ex.: PL, PLP, PEC, MPV, PDL, OFS. */
  sigla: string;
  numero: string;
  ano: number | null;
  ementa: string | null;
  /** id da proposição (Câmara) ou código da matéria (Senado). */
  idCasa: string | null;
  /** Página pública oficial da proposição. */
  url: string | null;
}

export interface Placar {
  sim: number;
  nao: number;
  abstencao: number;
}

export interface Votacao {
  /** "camara:2382675-97" ou "senado:7092". */
  id: string;
  casa: Casa;
  idCasa: string;
  /** AAAA-MM-DD */
  data: string;
  /** AAAA-MM-DDTHH:mm:ss no horário de Brasília, quando a fonte informa. */
  dataHora: string | null;
  /** "PLEN" no MVP; "nao_informado" se a fonte não disser. */
  orgao: string;
  descricao: string;
  resultado: Resultado;
  secreta: boolean;
  /** true quando há registro de voto por parlamentar. */
  nominal: boolean;
  /** Proposição principal (a afetada pela votação, não o requerimento). */
  proposicao: Proposicao | null;
  /** Contado a partir dos votos (ou dos totais oficiais, se a votação é secreta). */
  placar: Placar | null;
  /** Link oficial para mostrar como fonte. */
  urlFonte: string;
  urlApi: string;
}

export interface Parlamentar {
  /** "camara:204480" ou "senado:5672". */
  id: string;
  casa: Casa;
  idCasa: string;
  nome: string;
  partido: string | null;
  uf: string | null;
  /** Data da votação de onde vieram nome, partido e UF (o partido pode mudar). */
  referenciaData: string;
}

export interface Voto {
  votacaoId: string;
  parlamentarId: string;
  categoria: CategoriaVoto;
  valorOriginal: string;
  /** Motivo oficial da ausência, quando a fonte informa. */
  motivo: string | null;
  /** Partido e UF na data da votação. */
  partido: string | null;
  uf: string | null;
}

export type TipoAviso =
  | 'codigo_voto_desconhecido'
  | 'placar_divergente'
  | 'votos_indisponiveis'
  | 'proposicao_nao_identificada'
  | 'voto_duplicado'
  | 'orgao_nao_informado'
  | 'falha_coleta'; // a votação ficou de fora desta vez; a próxima coleta tenta de novo

/** Algo que precisa de revisão humana, sem impedir a coleta. */
export interface Aviso {
  tipo: TipoAviso;
  votacaoId: string;
  detalhe: string;
}

export interface Coleta {
  votacoes: Votacao[];
  parlamentares: Parlamentar[];
  votos: Voto[];
  avisos: Aviso[];
}
