import { z } from 'zod';

/** A API respondeu num formato diferente do esperado. */
export class ErroFormato extends Error {
  override name = 'ErroFormato';
}

function caminho(partes: readonly PropertyKey[], generico: boolean): string {
  let texto = '';
  for (const parte of partes) {
    if (typeof parte === 'number') texto += generico ? '[*]' : `[${parte}]`;
    else texto += texto ? `.${String(parte)}` : String(parte);
  }
  return texto || '(raiz)';
}

/**
 * Resume os problemas de validação agrupando os repetidos: 466 votos com o mesmo
 * problema viram uma linha só ("dados[*].tipoVoto … — 466 ocorrências").
 */
export function resumirErros(erro: z.ZodError, maxGrupos = 8): string {
  const grupos = new Map<string, { padrao: string; mensagem: string; exemplos: string[]; total: number }>();
  for (const problema of erro.issues) {
    const padrao = caminho(problema.path, true);
    const chave = `${padrao}\u0000${problema.message}`;
    const grupo = grupos.get(chave) ?? { padrao, mensagem: problema.message, exemplos: [], total: 0 };
    grupo.total += 1;
    if (grupo.exemplos.length < 3) grupo.exemplos.push(caminho(problema.path, false));
    grupos.set(chave, grupo);
  }
  const linhas = [...grupos.values()].slice(0, maxGrupos).map((g) =>
    g.total === 1
      ? `✖ ${g.exemplos[0]}: ${g.mensagem}`
      : `✖ ${g.padrao}: ${g.mensagem} — ${g.total} ocorrências (ex.: ${g.exemplos.join(', ')})`,
  );
  if (grupos.size > maxGrupos) linhas.push(`… e mais ${grupos.size - maxGrupos} tipo(s) de problema`);
  return linhas.join('\n');
}

/**
 * Valida a resposta de uma API na fronteira. Se o formato mudar, lança ErroFormato com
 * uma mensagem curta em vez de deixar passar dado errado.
 */
export function validar<S extends z.ZodType>(schema: S, dado: unknown, contexto: string): z.output<S> {
  const resultado = schema.safeParse(dado);
  if (!resultado.success) {
    throw new ErroFormato(`Formato inesperado em ${contexto}:\n${resumirErros(resultado.error)}`);
  }
  return resultado.data;
}
