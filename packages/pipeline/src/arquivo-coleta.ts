/**
 * Formato completo do arquivo gerado por `npm run votacoes`. A gravação no banco
 * valida o arquivo inteiro antes de abrir a conexão: arquivo fora do formato não grava nada.
 */
import { z } from 'zod';
import { CATEGORIAS_VOTO, type Coleta, type TipoAviso } from './tipos.js';

const TIPOS_AVISO = [
  'codigo_voto_desconhecido',
  'placar_divergente',
  'votos_indisponiveis',
  'proposicao_nao_identificada',
  'voto_duplicado',
  'orgao_nao_informado',
  'falha_coleta',
  'formato_inesperado',
] as const satisfies readonly TipoAviso[];

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data no formato AAAA-MM-DD');
const casa = z.enum(['camara', 'senado']);

export const ArquivoColetaCompleto = z.object({
  geradoEm: z.string().optional(),
  intervalo: z.object({ de: data, ate: data }).optional(),
  parlamentares: z.array(
    z.object({
      id: z.string().min(1),
      casa,
      idCasa: z.string().min(1),
      nome: z.string().min(1),
      partido: z.string().nullable(),
      uf: z.string().nullable(),
      referenciaData: data,
    }),
  ),
  votacoes: z.array(
    z.object({
      id: z.string().min(1),
      casa,
      idCasa: z.string().min(1),
      data,
      dataHora: z.string().nullable(),
      orgao: z.string(),
      descricao: z.string(),
      resultado: z.enum(['aprovada', 'rejeitada', 'indefinido']),
      secreta: z.boolean(),
      nominal: z.boolean(),
      proposicao: z
        .object({
          sigla: z.string(),
          numero: z.string(),
          ano: z.number().int().nullable(),
          ementa: z.string().nullable(),
          idCasa: z.string().nullable(),
          url: z.string().nullable(),
        })
        .nullable(),
      placar: z
        .object({ sim: z.number().int().min(0), nao: z.number().int().min(0), abstencao: z.number().int().min(0) })
        .nullable(),
      urlFonte: z.string(),
      urlApi: z.string(),
    }),
  ),
  votos: z.array(
    z.object({
      votacaoId: z.string().min(1),
      parlamentarId: z.string().min(1),
      categoria: z.enum(CATEGORIAS_VOTO),
      valorOriginal: z.string().nullable(),
      motivo: z.string().nullable(),
      partido: z.string().nullable(),
      uf: z.string().nullable(),
    }),
  ),
  avisos: z.array(z.object({ tipo: z.enum(TIPOS_AVISO), votacaoId: z.string(), detalhe: z.string() })),
});
export type ArquivoColetaCompleto = z.infer<typeof ArquivoColetaCompleto>;

// Garante, na compilação, que o esquema cobre o tipo Coleta e todos os tipos de aviso.
type Confere<T extends true> = T;
export type _ArquivoEhColeta = Confere<ArquivoColetaCompleto extends Coleta ? true : false>;
export type _TodosOsAvisos = Confere<TipoAviso extends (typeof TIPOS_AVISO)[number] ? true : false>;

/** Conferências que o esquema não expressa: cada voto aponta para votação e parlamentar do arquivo. */
export function conferirReferencias(coleta: Coleta): string[] {
  const votacoes = new Set(coleta.votacoes.map((v) => v.id));
  const parlamentares = new Set(coleta.parlamentares.map((p) => p.id));
  const problemas: string[] = [];
  for (const voto of coleta.votos) {
    if (!votacoes.has(voto.votacaoId)) problemas.push(`voto aponta para votação ausente: ${voto.votacaoId}`);
    if (!parlamentares.has(voto.parlamentarId)) problemas.push(`voto aponta para parlamentar ausente: ${voto.parlamentarId}`);
    if (problemas.length >= 10) break;
  }
  return problemas;
}
