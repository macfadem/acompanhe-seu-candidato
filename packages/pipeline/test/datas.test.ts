import { describe, expect, it } from 'vitest';
import { hojeEmBrasilia, janelasMensais, somarDias, validarData } from '../src/datas.js';

describe('janelasMensais', () => {
  it('quebra o intervalo por mês, sem atravessar meses', () => {
    expect(janelasMensais('2026-01-15', '2026-03-10')).toEqual([
      { de: '2026-01-15', ate: '2026-01-31' },
      { de: '2026-02-01', ate: '2026-02-28' },
      { de: '2026-03-01', ate: '2026-03-10' },
    ]);
  });

  it('um dia só vira uma janela', () => {
    expect(janelasMensais('2026-06-17', '2026-06-17')).toEqual([{ de: '2026-06-17', ate: '2026-06-17' }]);
  });

  it('atravessa a virada do ano', () => {
    expect(janelasMensais('2026-12-20', '2027-01-05')).toEqual([
      { de: '2026-12-20', ate: '2026-12-31' },
      { de: '2027-01-01', ate: '2027-01-05' },
    ]);
  });

  it('recusa intervalo invertido', () => {
    expect(() => janelasMensais('2026-06-30', '2026-06-01')).toThrow(/invertido/);
  });
});

describe('validarData', () => {
  it.each(['2026-02-30', '2026-6-1', '07/10/2026', ''])('recusa "%s"', (data) => {
    expect(() => validarData(data)).toThrow();
  });
  it('aceita 29/02 em ano bissexto', () => {
    expect(() => validarData('2028-02-29')).not.toThrow();
  });
});

describe('datas auxiliares', () => {
  it('somarDias lida com fim de mês', () => {
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('hojeEmBrasilia usa o fuso de Brasília (UTC-3)', () => {
    expect(hojeEmBrasilia(new Date('2026-10-07T02:30:00Z'))).toBe('2026-10-06');
    expect(hojeEmBrasilia(new Date('2026-10-07T03:30:00Z'))).toBe('2026-10-07');
  });
});
