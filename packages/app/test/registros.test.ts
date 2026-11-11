import { describe, expect, it } from 'vitest';
import { CATEGORIAS_VOTO } from '@acompanhe/pipeline/tipos';
import {
  caminhoDaVotacao,
  caminhoDeComparar,
  formatarMes,
  iniciais,
  lerIdsParaComparar,
} from '../src/apresentacao/formatos';
import { agruparPorMes, grupoDoRegistro, resumirRegistros, votacoesEmComum } from '../src/apresentacao/registros';
import { votacao, voto } from './apoio';

const v1 = votacao('camara:1-1', '2026-09-10');
const v2 = votacao('camara:2-1', '2026-09-24');
const v3 = votacao('camara:3-1', '2026-10-08');

describe('resumirRegistros', () => {
  it('conta votações da casa, registros e cada categoria', () => {
    const resumo = resumirRegistros([
      { votacao: v1, voto: voto(v1.id, 'camara:1') },
      { votacao: v2, voto: null },
      { votacao: v3, voto: voto(v3.id, 'camara:1', { categoria: 'obstrucao' }) },
    ]);
    expect(resumo.votacoes).toBe(3);
    expect(resumo.comRegistro).toBe(2);
    expect(resumo.porCategoria.sim).toBe(1);
    expect(resumo.porCategoria.obstrucao).toBe(1);
    expect(resumo.porCategoria.nao).toBe(0);
  });

  it('sem registros, tudo zero', () => {
    const resumo = resumirRegistros([]);
    expect(resumo).toMatchObject({ votacoes: 0, comRegistro: 0 });
    expect(Object.keys(resumo.porCategoria)).toEqual([...CATEGORIAS_VOTO]);
  });
});

describe('grupoDoRegistro', () => {
  it('a grade nunca separa sim de não: os dois são "voto"', () => {
    expect(grupoDoRegistro({ categoria: 'sim' })).toBe('voto');
    expect(grupoDoRegistro({ categoria: 'nao' })).toBe('voto');
  });

  it('ausência registrada, outro registro e sem registro são coisas diferentes', () => {
    expect(grupoDoRegistro({ categoria: 'licenca' })).toBe('ausencia');
    expect(grupoDoRegistro({ categoria: 'presente_sem_voto' })).toBe('outro');
    expect(grupoDoRegistro(null)).toBe('sem_registro');
  });
});

describe('agruparPorMes', () => {
  it('junta meses seguidos e mantém a ordem', () => {
    const grupos = agruparPorMes([{ votacao: v1 }, { votacao: v2 }, { votacao: v3 }]);
    expect(grupos.map((g) => [g.mes, g.itens.length])).toEqual([
      ['2026-09', 2],
      ['2026-10', 1],
    ]);
  });
});

describe('votacoesEmComum', () => {
  const ana = { parlamentar: { id: 'camara:1' }, registros: [{ votacao: v1, voto: voto(v1.id, 'camara:1') }, { votacao: v2, voto: voto(v2.id, 'camara:1') }, { votacao: v3, voto: null }] };
  const bruno = { parlamentar: { id: 'camara:2' }, registros: [{ votacao: v1, voto: voto(v1.id, 'camara:2', { categoria: 'nao' }) }, { votacao: v2, voto: null }, { votacao: v3, voto: voto(v3.id, 'camara:2') }] };
  const carla = { parlamentar: { id: 'camara:3' }, registros: [{ votacao: v1, voto: null }, { votacao: v2, voto: voto(v2.id, 'camara:3', { categoria: 'abstencao' }) }, { votacao: v3, voto: voto(v3.id, 'camara:3') }] };

  it('só entram votações com registro de pelo menos duas pessoas', () => {
    const linhas = votacoesEmComum([ana, bruno]);
    expect(linhas.map((l) => l.votacao.id)).toEqual(['camara:1-1']);
    expect(linhas[0]?.votos.map((v) => v?.categoria ?? null)).toEqual(['sim', 'nao']);
  });

  it('com três pessoas: mais recente primeiro, e null para quem não tem registro', () => {
    const linhas = votacoesEmComum([ana, bruno, carla]);
    expect(linhas.map((l) => [l.votacao.id, l.votos.map((v) => v?.categoria ?? null)])).toEqual([
      ['camara:3-1', [null, 'sim', 'sim']],
      ['camara:2-1', ['sim', null, 'abstencao']],
      ['camara:1-1', ['sim', 'nao', null]],
    ]);
  });

  it('entre casas diferentes não há votação em comum', () => {
    const s1 = votacao('senado:9', '2026-09-10');
    const senadora = { parlamentar: { id: 'senado:7' }, registros: [{ votacao: s1, voto: voto(s1.id, 'senado:7') }] };
    expect(votacoesEmComum([ana, senadora])).toEqual([]);
  });
});

describe('comparar: ids e endereços', () => {
  it('aceita um id ou vários, tira repetidos e inválidos e para em 5', () => {
    expect(lerIdsParaComparar(undefined)).toEqual([]);
    expect(lerIdsParaComparar('camara:1')).toEqual(['camara:1']);
    expect(lerIdsParaComparar(['camara:1', 'camara:1', 'x:2', 'senado:abc', '<script>', 'senado:2'])).toEqual(['camara:1', 'senado:2']);
    expect(lerIdsParaComparar(['camara:1', 'camara:2', 'camara:3', 'camara:4', 'camara:5', 'camara:6'])).toHaveLength(5);
  });

  it('monta o endereço da comparação', () => {
    expect(caminhoDeComparar([])).toBe('/comparar');
    expect(caminhoDeComparar(['camara:1', 'senado:2'])).toBe('/comparar?p=camara%3A1&p=senado%3A2');
    expect(caminhoDeComparar(['camara:1'], 'ana')).toBe('/comparar?p=camara%3A1&q=ana');
  });
});

describe('formatos novos', () => {
  it('iniciais: primeira e última palavra', () => {
    expect(iniciais('Ana Maria Exemplo')).toBe('AE');
    expect(iniciais('íris')).toBe('Í');
    expect(iniciais('  ')).toBe('');
  });

  it('mês por extenso curto, sem passar por Date', () => {
    expect(formatarMes('2026-10')).toBe('out/2026');
    expect(() => formatarMes('2026-13')).toThrow('mês fora do formato');
  });

  it('caminho da votação mantém o hífen do id da Câmara', () => {
    expect(caminhoDaVotacao({ casa: 'camara', idCasa: '2265603-43' })).toBe('/votacao/camara/2265603-43');
  });
});
