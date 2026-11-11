import { describe, expect, it } from 'vitest';
import { compararMaisRecentePrimeiro, criarFonteDaColeta, LIMITE_PADRAO, lerColeta } from '../src/fontes/coleta';
import { coleta, parlamentar, votacao, voto } from './apoio';

const origem = { tipo: 'exemplo' } as const;

describe('lerColeta', () => {
  it('aceita um arquivo no formato da coleta e descarta o que o site não usa (como os avisos)', () => {
    const lida = lerColeta(
      {
        ...coleta({ parlamentares: [parlamentar('camara:1', 'Ana')], votacoes: [votacao('camara:10-1', '2026-10-01')] }),
        votos: [voto('camara:10-1', 'camara:1')],
        avisos: [{ tipo: 'placar_divergente', votacaoId: 'camara:10-1', detalhe: 'x' }],
      },
      'teste.json',
    );
    expect(lida.votos).toHaveLength(1);
    expect(lida).not.toHaveProperty('avisos');
  });

  it('recusa arquivo fora do formato e diz o arquivo e o campo', () => {
    expect(() => lerColeta({ parlamentares: [], votacoes: [], votos: [{}] }, 'teste.json')).toThrow(
      /^teste\.json não está no formato da coleta — votos\.0\.votacaoId/,
    );
  });

  it('recusa link que não é http(s), porque ele vira href na página', () => {
    const arquivo = coleta({ votacoes: [votacao('camara:10-1', '2026-10-01', { urlFonte: 'javascript:alert(1)' })] });
    expect(() => lerColeta(arquivo, 'teste.json')).toThrow(/votacoes\.0\.urlFonte: link precisa ser http\(s\)/);
  });

  it('recusa voto que aponta para votação ou parlamentar que não estão no arquivo', () => {
    const arquivo = coleta({ parlamentares: [parlamentar('camara:1', 'Ana')], votos: [voto('camara:99-1', 'camara:2')] });
    expect(() => lerColeta(arquivo, 'teste.json')).toThrow(
      'teste.json tem referências quebradas — voto aponta para votação ausente: camara:99-1; voto aponta para parlamentar ausente: camara:2',
    );
  });
});

describe('criarFonteDaColeta', () => {
  const fonte = criarFonteDaColeta(
    coleta({
      parlamentares: [
        parlamentar('senado:5', 'Álvaro'),
        parlamentar('camara:3', 'Zeca'),
        parlamentar('camara:2', 'Érica'),
        parlamentar('camara:1', 'Eduardo'),
        parlamentar('camara:4', 'Álvaro'),
      ],
      votacoes: [
        votacao('camara:10-1', '2026-09-30'),
        votacao('camara:11-1', '2026-10-21', { dataHora: '2026-10-21T10:00:00' }),
        votacao('camara:12-1', '2026-10-21', { dataHora: '2026-10-21T18:30:00' }),
        votacao('camara:13-1', '2026-10-21', { dataHora: null }),
      ],
      votos: [
        voto('camara:10-1', 'camara:1'),
        voto('camara:11-1', 'camara:1'),
        voto('camara:12-1', 'camara:1'),
        voto('camara:13-1', 'camara:1'),
        voto('camara:12-1', 'camara:2', { categoria: 'nao', valorOriginal: 'Não' }),
      ],
    }),
    origem,
  );

  it('lista a Câmara antes do Senado e, em cada casa, em ordem alfabética com acentos', async () => {
    const nomes = (await fonte.listarParlamentares()).map((p) => `${p.casa}:${p.nome}`);
    expect(nomes).toEqual(['camara:Álvaro', 'camara:Eduardo', 'camara:Érica', 'camara:Zeca', 'senado:Álvaro']);
  });

  it('busca pelo par casa + id da casa', async () => {
    expect((await fonte.buscarParlamentar('camara', '2'))?.nome).toBe('Érica');
    expect(await fonte.buscarParlamentar('senado', '2')).toBeNull();
  });

  it('devolve os votos do mais recente para o mais antigo; no mesmo dia, sem hora vai por último', async () => {
    const { itens, total } = await fonte.votosDoParlamentar('camara:1');
    expect(itens.map((i) => i.votacao.id)).toEqual(['camara:12-1', 'camara:11-1', 'camara:13-1', 'camara:10-1']);
    expect(total).toBe(4);
  });

  it('limita a página e informa o total', async () => {
    const { itens, total } = await fonte.votosDoParlamentar('camara:1', { limite: 2 });
    expect(itens.map((i) => i.votacao.id)).toEqual(['camara:12-1', 'camara:11-1']);
    expect(total).toBe(4);
  });

  it('parlamentar sem votos: página vazia e total zero', async () => {
    expect(await fonte.votosDoParlamentar('camara:3')).toEqual({ itens: [], total: 0 });
  });

  it.each([0, -1, 1.5])('recusa limite inválido (%s)', async (limite) => {
    await expect(fonte.votosDoParlamentar('camara:1', { limite })).rejects.toThrow(RangeError);
  });

  it('registros: todas as votações da casa, da mais antiga para a mais recente, com null onde não há registro', async () => {
    const registros = await fonte.registrosDoParlamentar('camara:2');
    expect(registros.map((r) => [r.votacao.id, r.voto?.categoria ?? null])).toEqual([
      ['camara:10-1', null],
      ['camara:13-1', null],
      ['camara:11-1', null],
      ['camara:12-1', 'nao'],
    ]);
    expect(await fonte.registrosDoParlamentar('senado:5')).toEqual([]);
    expect(await fonte.registrosDoParlamentar('camara:999')).toEqual([]);
  });

  it('lista as votações da mais recente para a mais antiga, com filtro por casa e limite', async () => {
    const todas = await fonte.listarVotacoes();
    expect(todas.itens.map((v) => v.id)).toEqual(['camara:12-1', 'camara:11-1', 'camara:13-1', 'camara:10-1']);
    expect(await fonte.listarVotacoes({ casa: 'senado' })).toEqual({ itens: [], total: 0 });
    const pagina = await fonte.listarVotacoes({ casa: 'camara', limite: 1 });
    expect(pagina.itens.map((v) => v.id)).toEqual(['camara:12-1']);
    expect(pagina.total).toBe(4);
    await expect(fonte.listarVotacoes({ limite: 0 })).rejects.toThrow(RangeError);
  });

  it('detalhe da votação: os votos com o parlamentar, em ordem alfabética', async () => {
    const detalhe = await fonte.buscarVotacao('camara', '12-1');
    expect(detalhe?.votos.map((v) => [v.parlamentar.nome, v.voto.categoria])).toEqual([
      ['Eduardo', 'sim'],
      ['Érica', 'nao'],
    ]);
    expect(await fonte.buscarVotacao('senado', '12-1')).toBeNull();
  });

  it('o limite padrão é 50', () => {
    expect(LIMITE_PADRAO).toBe(50);
  });
});

describe('compararMaisRecentePrimeiro', () => {
  it('desempata pelo id quando data e hora são iguais, para a ordem nunca variar', () => {
    const a = { votacao: votacao('camara:1-1', '2026-10-01'), voto: voto('camara:1-1', 'camara:1') };
    const b = { votacao: votacao('camara:2-1', '2026-10-01'), voto: voto('camara:2-1', 'camara:1') };
    expect([a, b].sort(compararMaisRecentePrimeiro).map((i) => i.votacao.id)).toEqual(['camara:2-1', 'camara:1-1']);
    expect([b, a].sort(compararMaisRecentePrimeiro).map((i) => i.votacao.id)).toEqual(['camara:2-1', 'camara:1-1']);
  });
});
