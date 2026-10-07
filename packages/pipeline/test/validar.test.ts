import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ErroFormato, resumirErros, validar } from '../src/validar.js';

const Votos = z.object({ dados: z.array(z.object({ tipoVoto: z.string(), id: z.number() })) });

function erroDe(schema: z.ZodType, dado: unknown): z.ZodError {
  const r = schema.safeParse(dado);
  if (r.success) throw new Error('a validação deveria falhar');
  return r.error;
}

describe('resumo dos erros de formato', () => {
  it('466 problemas iguais viram uma linha só, com exemplos', () => {
    const dado = { dados: Array.from({ length: 466 }, (_, i) => ({ tipoVoto: null, id: i })) };
    const texto = resumirErros(erroDe(Votos, dado));
    expect(texto.split('\n')).toHaveLength(1);
    expect(texto).toMatch(/^✖ dados\[\*\]\.tipoVoto: .+ — 466 ocorrências \(ex\.: dados\[0\]\.tipoVoto, dados\[1\]\.tipoVoto, dados\[2\]\.tipoVoto\)$/);
  });

  it('problemas diferentes aparecem separados; ocorrência única mostra o caminho exato', () => {
    const texto = resumirErros(erroDe(Votos, { dados: [{ tipoVoto: 'Sim', id: 'x' }, { tipoVoto: 2, id: 3 }] }));
    expect(texto.split('\n')).toEqual([
      expect.stringMatching(/^✖ dados\[0\]\.id: /),
      expect.stringMatching(/^✖ dados\[1\]\.tipoVoto: /),
    ]);
  });

  it('limita a quantidade de linhas', () => {
    const Muitos = z.object(Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`campo${i}`, z.string()])));
    const texto = resumirErros(erroDe(Muitos, {}), 8);
    expect(texto.split('\n')).toHaveLength(9);
    expect(texto).toMatch(/… e mais 4 tipo\(s\) de problema$/);
  });

  it('validar lança ErroFormato com o contexto e o resumo', () => {
    expect(() => validar(Votos, { dados: [{ tipoVoto: null, id: 1 }] }, 'votos 2645346-18')).toThrow(ErroFormato);
    expect(() => validar(Votos, { dados: [{ tipoVoto: null, id: 1 }] }, 'votos 2645346-18')).toThrow(
      /^Formato inesperado em votos 2645346-18:\n✖ dados\[0\]\.tipoVoto/,
    );
  });
});
