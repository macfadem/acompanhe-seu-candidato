import { z } from 'zod';

/** A API respondeu num formato diferente do esperado: a coleta inteira deve parar. */
export class ErroFormato extends Error {
  override name = 'ErroFormato';
}

/**
 * Valida a resposta de uma API na fronteira. Se o formato mudar, a coleta para com
 * uma mensagem clara em vez de gravar dado errado.
 */
export function validar<S extends z.ZodType>(schema: S, dado: unknown, contexto: string): z.output<S> {
  const resultado = schema.safeParse(dado);
  if (!resultado.success) {
    throw new ErroFormato(`Formato inesperado em ${contexto}:\n${z.prettifyError(resultado.error)}`);
  }
  return resultado.data;
}
