/**
 * O que o site lê de um arquivo da coleta: só os campos que ele mostra (os avisos ficam de
 * fora) e com uma exigência a mais — todo link precisa ser http(s), porque vira `href`.
 *
 * Por que não reaproveitar o esquema do pipeline (`ArquivoColetaCompleto`) em tempo de execução:
 * o código do pipeline importa os vizinhos como `./tipos.js` (padrão do Node), e o Turbopack
 * não resolve `.js` para `.ts`. Em compensação, a checagem de tipos no fim deste arquivo quebra
 * se o arquivo do pipeline deixar de ter algum campo que o site usa.
 */
import { z } from 'zod';
import { CATEGORIAS_VOTO } from '@acompanhe/pipeline/tipos';
import type { ArquivoColetaCompleto } from '@acompanhe/pipeline/arquivo-coleta';

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data no formato AAAA-MM-DD');
const casa = z.enum(['camara', 'senado']);
const link = z.url({ protocol: /^https?$/, error: 'link precisa ser http(s)' });

export const ColetaLida = z.object({
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
          url: link.nullable(),
        })
        .nullable(),
      placar: z
        .object({ sim: z.number().int().min(0), nao: z.number().int().min(0), abstencao: z.number().int().min(0) })
        .nullable(),
      urlFonte: link,
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
});
export type ColetaLida = z.infer<typeof ColetaLida>;

/** Cada voto aponta para uma votação e um parlamentar do mesmo arquivo. Para no 10º problema. */
export function conferirReferencias(coleta: ColetaLida): string[] {
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

// Na compilação: o arquivo que o pipeline grava tem tudo o que o site lê.
type Confere<T extends true> = T;
export type _ArquivoDoPipelineCabeNoSite = Confere<ArquivoColetaCompleto extends ColetaLida ? true : false>;
