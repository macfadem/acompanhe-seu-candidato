import { describe, expect, it } from 'vitest';
import { normalizarRespostaSenado, normalizarVotacaoSenado, RespostaVotacoesSenado, type VotacaoSenado } from '../src/senado.js';
import type { Coleta, Votacao } from '../src/tipos.js';
import { validar } from '../src/validar.js';
import { fixture } from './apoio.js';

const lerFixture = (): VotacaoSenado[] =>
  validar(RespostaVotacoesSenado, fixture('senado-votacao-2026-06.json'), 'fixture do Senado');

function votacao(coleta: Coleta, id: string): Votacao {
  const v = coleta.votacoes.find((x) => x.id === id);
  if (!v) throw new Error(`votação ${id} não encontrada`);
  return v;
}

function contarCategorias(coleta: Coleta, votacaoId: string): Record<string, number> {
  const contagem: Record<string, number> = {};
  for (const v of coleta.votos.filter((x) => x.votacaoId === votacaoId)) {
    contagem[v.categoria] = (contagem[v.categoria] ?? 0) + 1;
  }
  return contagem;
}

describe('Senado — votações reais de junho/2026', () => {
  const coleta = normalizarRespostaSenado(lerFixture());

  it('normaliza 3 votações, 243 votos e 81 senadores sem nenhum aviso', () => {
    expect(coleta.votacoes.map((v) => v.id)).toEqual(['senado:7092', 'senado:7093', 'senado:7095']);
    expect(coleta.votos).toHaveLength(243);
    expect(coleta.parlamentares).toHaveLength(81);
    expect(coleta.avisos).toEqual([]);
  });

  it('PLP 55/2026: placar contado a partir dos votos bate com o texto oficial (Sim 58, Não 1)', () => {
    const v = votacao(coleta, 'senado:7092');
    expect(v).toMatchObject({
      casa: 'senado',
      data: '2026-06-09',
      orgao: 'PLEN',
      resultado: 'aprovada',
      secreta: false,
      nominal: true,
      placar: { sim: 58, nao: 1, abstencao: 0 },
      proposicao: {
        sigla: 'PLP',
        numero: '55',
        ano: 2026,
        idCasa: '173694',
        url: 'https://www25.senado.leg.br/web/atividade/materias/-/materia/173694',
      },
      urlFonte: 'https://www25.senado.leg.br/web/atividade/materias/-/materia/173694',
    });
    expect(contarCategorias(coleta, 'senado:7092')).toEqual({
      sim: 58,
      nao: 1,
      ausente_justificado: 17, // 15 "Atividade parlamentar" + 2 "Missão"
      licenca: 3,
      presente_sem_voto: 1,
      presidente: 1,
    });
  });

  it('guarda o motivo oficial da ausência e o valor original', () => {
    const anaPaula = coleta.votos.find((x) => x.votacaoId === 'senado:7092' && x.parlamentarId === 'senado:6358');
    expect(anaPaula).toMatchObject({ categoria: 'ausente_justificado', valorOriginal: 'AP', motivo: 'Atividade parlamentar' });
  });

  it('OFS 4/2026 (secreta): usa os totais oficiais e não expõe voto individual', () => {
    const v = votacao(coleta, 'senado:7093');
    expect(v.secreta).toBe(true);
    expect(v.placar).toEqual({ sim: 53, nao: 16, abstencao: 0 });
    const categorias = contarCategorias(coleta, 'senado:7093');
    expect(categorias.secreto).toBe(69); // = 53 + 16 + 0
    expect(categorias.sim).toBeUndefined();
    expect(categorias.nao).toBeUndefined();
  });

  it('PLP 73/2025: ano é o da matéria; licença-paternidade e abstenção mapeadas', () => {
    const v = votacao(coleta, 'senado:7095');
    expect(v.proposicao).toMatchObject({ sigla: 'PLP', numero: '73', ano: 2025 });
    expect(v.placar).toEqual({ sim: 51, nao: 17, abstencao: 1 });
    const bittar = coleta.votos.find((x) => x.votacaoId === 'senado:7095' && x.parlamentarId === 'senado:285');
    expect(bittar).toMatchObject({ categoria: 'licenca', motivo: 'Licença paternidade ou ao adotante' });
  });

  it('parlamentar fica com o partido/UF da votação mais recente', () => {
    const alan = coleta.parlamentares.find((p) => p.id === 'senado:5672');
    expect(alan).toEqual({
      id: 'senado:5672',
      casa: 'senado',
      idCasa: '5672',
      nome: 'Alan Rick',
      partido: 'REPUBLICANOS',
      uf: 'AC',
      referenciaData: '2026-06-16',
    });
  });
});

describe('Senado — avisos e casos de borda', () => {
  it('avisa quando o placar contado diverge do texto oficial', () => {
    const lista = lerFixture();
    const plp55 = lista[0]!;
    const voto = plp55.votos!.find((x) => x.siglaVotoParlamentar === 'Sim')!;
    voto.siglaVotoParlamentar = 'Não';
    const coleta = normalizarVotacaoSenado(plp55)!;
    expect(coleta.avisos).toEqual([
      expect.objectContaining({ tipo: 'placar_divergente', votacaoId: 'senado:7092' }),
    ]);
  });

  it('código de voto desconhecido vira "outro" com aviso, sem travar a coleta', () => {
    const plp55 = lerFixture()[0]!;
    const ausente = plp55.votos!.find((x) => x.siglaVotoParlamentar === 'AP')!;
    ausente.siglaVotoParlamentar = 'XYZ';
    ausente.descricaoVotoParlamentar = 'Situação nova';
    const coleta = normalizarVotacaoSenado(plp55)!;
    expect(coleta.votos.find((x) => x.valorOriginal === 'XYZ')?.categoria).toBe('outro');
    expect(coleta.avisos).toEqual([
      expect.objectContaining({
        tipo: 'codigo_voto_desconhecido',
        votacaoId: 'senado:7092',
        detalhe: 'valor "XYZ" (descrição oficial: "Situação nova") em 1 registro(s), classificado como "outro" — revisar categorias.ts',
      }),
    ]);
  });

  it('"NCom" (Não Compareceu) tem categoria própria e não gera aviso', () => {
    // Caso real: votação 7105 (PLP 74/2026, 03/09/2026) tinha 1 registro NCom.
    const plp55 = lerFixture()[0]!;
    const registro = plp55.votos!.find((x) => x.siglaVotoParlamentar === 'AP')!;
    registro.siglaVotoParlamentar = 'NCom';
    registro.descricaoVotoParlamentar = 'Não Compareceu';
    const coleta = normalizarVotacaoSenado(plp55)!;
    expect(coleta.votos.find((x) => x.valorOriginal === 'NCom')).toMatchObject({
      categoria: 'nao_compareceu',
      motivo: 'Não Compareceu',
    });
    expect(coleta.avisos).toEqual([]);
  });

  it('ignora votação de comissão (MVP é só plenário)', () => {
    const plp55 = lerFixture()[0]!;
    plp55.informeLegislativo = { ...plp55.informeLegislativo, siglaColegiado: 'CCJ' };
    expect(normalizarVotacaoSenado(plp55)).toBeNull();
  });

  it('votação secreta sem totais fica sem placar (nunca inventa números)', () => {
    const ofs = lerFixture()[1]!;
    ofs.totalVotosSim = null;
    ofs.totalVotosNao = null;
    ofs.totalVotosAbstencao = null;
    const coleta = normalizarVotacaoSenado(ofs)!;
    expect(coleta.votacoes[0]?.placar).toBeNull();
  });

  it('voto duplicado gera aviso e fica um registro só', () => {
    const plp55 = lerFixture()[0]!;
    plp55.votos!.push({ ...plp55.votos![0]! });
    const coleta = normalizarVotacaoSenado(plp55)!;
    expect(coleta.votos).toHaveLength(81);
    expect(coleta.avisos.map((a) => a.tipo)).toContain('voto_duplicado');
  });
});
