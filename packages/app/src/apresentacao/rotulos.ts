/**
 * Textos que o site mostra para cada registro. Regra de neutralidade: o mesmo rótulo e o
 * mesmo estilo para todos os parlamentares — o texto descreve o registro oficial, não o julga.
 */
import type { Casa, CategoriaVoto, Resultado } from '@acompanhe/pipeline/tipos';

export const ROTULO_VOTO = {
  sim: 'Sim',
  nao: 'Não',
  abstencao: 'Abstenção',
  obstrucao: 'Obstrução',
  ausente_justificado: 'Ausente em atividade parlamentar ou missão',
  licenca: 'Em licença',
  presente_sem_voto: 'Presente, sem voto registrado',
  nao_compareceu: 'Não compareceu',
  presidente: 'Presidindo a sessão',
  secreto: 'Votou (votação secreta)',
  outro: 'Outro registro',
} as const satisfies Record<CategoriaVoto, string>;

export const EXPLICACAO_VOTO = {
  sim: 'Votou sim nesta votação. A descrição diz o que estava em votação (o texto, uma emenda, um requerimento).',
  nao: 'Votou não nesta votação. A descrição diz o que estava em votação (o texto, uma emenda, um requerimento).',
  abstencao: 'Registrou abstenção nesta votação.',
  obstrucao: 'Registrou obstrução, instrumento previsto no regimento.',
  ausente_justificado: 'A fonte oficial registra ausência por atividade parlamentar ou missão oficial.',
  licenca: 'A fonte oficial registra licença (saúde, particular, paternidade e outras).',
  presente_sem_voto: 'Estava presente na sessão, mas não há voto registrado nesta votação.',
  nao_compareceu:
    'A fonte oficial registra que não compareceu. Só o Senado publica esse registro; a Câmara não lista quem não votou.',
  presidente: 'Presidia a sessão. Nas votações abertas, quem preside só vota para desempatar.',
  secreto: 'Votação secreta: a fonte oficial informa que participou, mas não a escolha.',
  outro: 'Registro que o projeto ainda não classificou. Confira na fonte oficial.',
} as const satisfies Record<CategoriaVoto, string>;

export const ROTULO_RESULTADO = {
  aprovada: 'Aprovada',
  rejeitada: 'Rejeitada',
  indefinido: 'Resultado não informado pela fonte',
} as const satisfies Record<Resultado, string>;

export const ROTULO_CASA = {
  camara: 'Câmara dos Deputados',
  senado: 'Senado Federal',
} as const satisfies Record<Casa, string>;
