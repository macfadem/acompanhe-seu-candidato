import { describe, expect, it } from 'vitest';
import { contarPlacar, placarDoTexto } from '../src/placar.js';

describe('placarDoTexto (formatos reais)', () => {
  it.each([
    ['Aprovado o Requerimento de Urgência (Art. 155 do RICD). Sim: 273; Não: 160; Abstenção: 4; Total: 437.', 273, 160, 4],
    ['Aprovado o projeto, com o seguinte resultado: Sim - 58, Não - 1, Presidente - 1, Total - 60.', 58, 1, 0],
    ['Aprovado o projeto e as Emendas nºs 4 e 5, com o seguinte resultado: sim: 51; não: 17; abstenção: 1; Presidente: 1; total: 70.', 51, 17, 1],
    ['Aprovado o projeto, com seguinte resultado: Sim – 54. Não - 0. Abstenção - 0. Presidência -1. Total - 55.', 54, 0, 0],
    ['Aprovada a indicação, com o seguinte resultado:  \r\nSim - 53. Não - 16. Total - 69.', 53, 16, 0],
  ])('%s', (texto, sim, nao, abstencao) => {
    expect(placarDoTexto(texto)).toEqual({ sim, nao, abstencao });
  });

  it('sem placar no texto → null', () => {
    expect(placarDoTexto('Mantido o texto.')).toBeNull();
    expect(placarDoTexto(null)).toBeNull();
  });

  it('dois placares no mesmo texto → null (não dá para saber qual conferir)', () => {
    expect(placarDoTexto('Requerimento: Sim - 40, Não - 20. Projeto: Sim - 60, Não - 2.')).toBeNull();
  });

  it('não confunde palavras que contêm "sim"', () => {
    expect(placarDoTexto('Aprovado assim: 3 emendas')).toBeNull();
  });
});

describe('contarPlacar', () => {
  it('conta só sim, não e abstenção', () => {
    const votos = ['sim', 'sim', 'nao', 'abstencao', 'obstrucao', 'licenca', 'presidente'] as const;
    expect(contarPlacar(votos.map((categoria) => ({ categoria })))).toEqual({ sim: 2, nao: 1, abstencao: 1 });
  });
});
