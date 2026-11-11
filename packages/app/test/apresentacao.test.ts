import { describe, expect, it } from 'vitest';
import { CATEGORIAS_VOTO } from '@acompanhe/pipeline/tipos';
import {
  caminhoDoParlamentar,
  descreverContagem,
  formatarData,
  formatarPlacar,
  partidoUf,
  tituloDaVotacao,
} from '../src/apresentacao/formatos';
import { EXPLICACAO_VOTO, ROTULO_VOTO } from '../src/apresentacao/rotulos';
import { votacao } from './apoio';

describe('formatarData', () => {
  it('converte AAAA-MM-DD em DD/MM/AAAA sem passar por Date (que cairia no dia anterior no fuso de Brasília)', () => {
    expect(formatarData('2026-06-01')).toBe('01/06/2026');
    expect(formatarData('2026-12-31')).toBe('31/12/2026');
  });

  it.each(['01/06/2026', '2026-06-01T10:00:00', ''])('recusa "%s"', (valor) => {
    expect(() => formatarData(valor)).toThrow('data fora do formato AAAA-MM-DD');
  });
});

describe('tituloDaVotacao', () => {
  it('usa sigla, número e ano da proposição', () => {
    expect(tituloDaVotacao(votacao('camara:1-1', '2026-10-01'))).toBe('PL 9001/2026');
  });

  it('sem ano, fica só sigla e número', () => {
    const v = votacao('camara:1-1', '2026-10-01', {
      proposicao: { sigla: 'REQ', numero: '12', ano: null, ementa: null, idCasa: null, url: null },
    });
    expect(tituloDaVotacao(v)).toBe('REQ 12');
  });

  it('sem proposição identificada, usa a descrição oficial', () => {
    const v = votacao('camara:1-1', '2026-10-01', { proposicao: null, descricao: 'Aprovado requerimento.' });
    expect(tituloDaVotacao(v)).toBe('Aprovado requerimento.');
  });
});

describe('formatos curtos', () => {
  it('placar', () => {
    expect(formatarPlacar({ sim: 312, nao: 141, abstencao: 3 })).toBe('Sim 312, Não 141, Abstenção 3');
  });

  it.each([
    ['PEX', 'MG', 'PEX-MG'],
    ['PEX', null, 'PEX'],
    [null, 'MG', 'MG'],
    [null, null, 'Sem partido informado'],
  ] as const)('partido %s e UF %s → %s', (partido, uf, esperado) => {
    expect(partidoUf(partido, uf)).toBe(esperado);
  });

  it('caminho da página do parlamentar', () => {
    expect(caminhoDoParlamentar({ casa: 'senado', idCasa: '5672' })).toBe('/parlamentar/senado/5672');
  });

  it.each([
    [0, 0, ''],
    [1, 1, '1 votação no período coletado.'],
    [5, 5, '5 votações no período coletado.'],
    [50, 230, 'As 50 mais recentes de 230 votações no período coletado.'],
  ])('contagem: %i de %i', (mostrados, total, esperado) => {
    expect(descreverContagem(mostrados, total)).toBe(esperado);
  });
});

describe('rótulos', () => {
  it('cada categoria tem rótulo próprio: duas categorias nunca aparecem iguais na página', () => {
    const rotulos = CATEGORIAS_VOTO.map((c) => ROTULO_VOTO[c]);
    expect(new Set(rotulos).size).toBe(CATEGORIAS_VOTO.length);
  });

  it('cada categoria tem explicação na legenda', () => {
    for (const c of CATEGORIAS_VOTO) expect(EXPLICACAO_VOTO[c].length).toBeGreaterThan(20);
  });
});
