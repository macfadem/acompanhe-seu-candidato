import { describe, expect, it } from 'vitest';
import {
  coletarCamara,
  escolherProposicaoCamara,
  listarVotacoesPlenarioCamara,
  normalizarVotacaoCamara,
  RespostaDetalheCamara,
  RespostaListaCamara,
  RespostaVotosCamara,
  urlListaVotacoesCamara,
  urlVotacaoCamara,
  urlVotosCamara,
  type VotacaoItemCamara,
  type VotoCamara,
} from '../src/camara.js';
import { ErroHttp } from '../src/http.js';
import { validar } from '../src/validar.js';
import { clienteFalso, fixture } from './apoio.js';

const lista = validar(RespostaListaCamara, fixture('camara-votacoes-lista-2026-06.json'), 'lista');
const detalhe97 = validar(RespostaDetalheCamara, fixture('camara-votacao-2382675-97.json'), 'detalhe').dados;
const votosTrecho = validar(RespostaVotosCamara, fixture('camara-votos-2633410-8-trecho.json'), 'votos').dados;

function item(id: string): VotacaoItemCamara {
  const achado = lista.dados.find((x) => x.id === id);
  if (!achado) throw new Error(`item ${id} não está na fixture`);
  return achado;
}

const IDS_PLENARIO = [
  '2525254-18',
  '2633410-8',
  '2610975-25',
  '2610975-23',
  '2610975-20',
  '2610975-19',
  '2610975-15',
  '2382675-100',
  '2382675-97',
];

describe('Câmara — lista de votações', () => {
  it('mesmo se o filtro da API falhar, só ficam votações de plenário (PLEN)', async () => {
    const proxima = lista.links?.find((l) => l.rel === 'next')?.href ?? '';
    const cliente = clienteFalso({
      [urlListaVotacoesCamara('2026-06-01', '2026-06-30')]: fixture('camara-votacoes-lista-2026-06.json'),
      [proxima]: { dados: [], links: [] },
    });
    const itens = await listarVotacoesPlenarioCamara(cliente, '2026-06-01', '2026-06-30');
    expect(itens.map((i) => i.id).sort()).toEqual([...IDS_PLENARIO].sort());
    expect(cliente.chamadas).toHaveLength(2); // seguiu a paginação até o fim
  });

  it('a URL pede só o plenário (idOrgao=180), em ordem cronológica', () => {
    const url = new URL(urlListaVotacoesCamara('2026-06-01', '2026-06-30'));
    expect(url.searchParams.get('idOrgao')).toBe('180');
    expect(url.searchParams.get('ordem')).toBe('ASC');
    expect(url.searchParams.get('dataInicio')).toBe('2026-06-01');
  });
});

describe('Câmara — proposição principal', () => {
  it('usa a proposição afetada (PL 4133/2023), não o objeto votado', () => {
    expect(escolherProposicaoCamara(item('2382675-97'), detalhe97)).toEqual({
      sigla: 'PL',
      numero: '4133',
      ano: 2023,
      ementa:
        'Dispõe sobre diretrizes para a formulação da política industrial, tecnológica e de comércio exterior brasileira.',
      idCasa: '2382675',
      url: 'https://www.camara.leg.br/propostas-legislativas/2382675',
    });
  });

  it('sem proposição afetada, usa o objeto votado (REQ 3557/2026)', () => {
    expect(escolherProposicaoCamara(item('2633410-8'), null)).toEqual({
      sigla: 'REQ',
      numero: '3557',
      ano: 2026,
      ementa: null,
      idCasa: '2633410',
      url: 'https://www.camara.leg.br/propostas-legislativas/2633410',
    });
  });
});

describe('Câmara — votos', () => {
  it('converte os votos reais e acusa divergência quando só há um trecho deles', () => {
    const coleta = normalizarVotacaoCamara(item('2633410-8'), null, votosTrecho);
    expect(coleta.votos).toHaveLength(10);
    expect(coleta.votacoes[0]?.placar).toEqual({ sim: 5, nao: 4, abstencao: 1 });
    // O texto oficial diz 273 × 160 × 4: a conferência pega a diferença.
    expect(coleta.avisos.map((a) => a.tipo)).toEqual(['placar_divergente']);
    expect(coleta.parlamentares.find((p) => p.id === 'camara:235776')).toMatchObject({
      nome: 'Sérgio Turra',
      partido: 'PP',
      uf: 'RS',
    });
  });

  it('votação coerente (sintética, com os mesmos votos) não gera aviso', () => {
    const sintetica: VotacaoItemCamara = {
      id: '9999999-1',
      data: '2026-06-17',
      dataHoraRegistro: '2026-06-17T21:00:00',
      siglaOrgao: 'PLEN',
      descricao: 'Votação sintética de teste. Sim: 5; Não: 4; Abstenção: 1; Total: 10.',
      aprovacao: 1,
      proposicaoObjeto: 'PL 1/2026',
      uriProposicaoObjeto: null,
    };
    const coleta = normalizarVotacaoCamara(sintetica, null, votosTrecho);
    expect(coleta.avisos).toEqual([]);
    expect(coleta.votacoes[0]).toMatchObject({ resultado: 'aprovada', nominal: true, placar: { sim: 5, nao: 4, abstencao: 1 } });
  });

  it('Obstrução e quem preside (Art. 17) não entram no placar (sintético)', () => {
    const base = votosTrecho[0]!;
    const votos: VotoCamara[] = [
      { ...base, tipoVoto: 'Obstrução', deputado_: { ...base.deputado_, id: 1 } },
      { ...base, tipoVoto: 'Art. 17', deputado_: { ...base.deputado_, id: 2 } },
      { ...base, tipoVoto: 'Sim', deputado_: { ...base.deputado_, id: 3 } },
    ];
    const coleta = normalizarVotacaoCamara(item('2610975-20'), null, votos);
    expect(coleta.votos.map((v) => v.categoria)).toEqual(['obstrucao', 'presidente', 'sim']);
    expect(coleta.votacoes[0]?.placar).toEqual({ sim: 1, nao: 0, abstencao: 0 });
  });

  it('votação simbólica: sem votos individuais e sem placar', () => {
    const coleta = normalizarVotacaoCamara(item('2610975-19'), null, []);
    expect(coleta.votacoes[0]).toMatchObject({ nominal: false, placar: null, resultado: 'aprovada' });
  });
});

describe('Câmara — coleta completa (cliente falso)', () => {
  it('pagina, trata 404, respeita a concorrência e monta tudo', async () => {
    const plenario = lista.dados.filter((x) => x.siglaOrgao === 'PLEN');
    const urlPagina1 = urlListaVotacoesCamara('2026-06-17', '2026-06-17');
    const urlPagina2 = `${urlPagina1}&pagina=2`;
    const rotas: Record<string, unknown> = {
      [urlPagina1]: { dados: plenario.slice(0, 5), links: [{ rel: 'next', href: urlPagina2 }] },
      [urlPagina2]: { dados: plenario.slice(5), links: [{ rel: 'self', href: urlPagina2 }] },
    };
    for (const v of plenario) {
      rotas[urlVotosCamara(v.id)] = { dados: [] };
      rotas[urlVotacaoCamara(v.id)] = { dados: { id: v.id, proposicoesAfetadas: [] } };
    }
    rotas[urlVotosCamara('2633410-8')] = fixture('camara-votos-2633410-8-trecho.json');
    rotas[urlVotosCamara('2610975-23')] = new ErroHttp(404, urlVotosCamara('2610975-23'));
    rotas[urlVotacaoCamara('2382675-97')] = fixture('camara-votacao-2382675-97.json');

    const cliente = clienteFalso(rotas, 5);
    const coleta = await coletarCamara(cliente, '2026-06-17', '2026-06-17', 2);

    expect(coleta.votacoes).toHaveLength(9);
    expect(cliente.chamadas).toHaveLength(2 + 9 * 2); // 2 páginas + votos e detalhe de cada votação
    expect(cliente.maxSimultaneas).toBeLessThanOrEqual(2);
    expect(coleta.votos).toHaveLength(10);

    const pl4133 = coleta.votacoes.find((v) => v.id === 'camara:2382675-97');
    expect(pl4133?.proposicao).toMatchObject({ sigla: 'PL', numero: '4133', ano: 2023 });

    const semVotos = coleta.votacoes.find((v) => v.id === 'camara:2610975-23');
    expect(semVotos?.nominal).toBe(false);
    expect(coleta.avisos).toContainEqual(
      expect.objectContaining({ tipo: 'votos_indisponiveis', votacaoId: 'camara:2610975-23' }),
    );
  });

  const rotasDeUmaVotacao = (id: string, votos: unknown): Record<string, unknown> => ({
    [urlListaVotacoesCamara('2026-06-17', '2026-06-17')]: { dados: [item(id), item('2382675-97')], links: [] },
    [urlVotosCamara(id)]: votos,
    [urlVotacaoCamara(id)]: { dados: { id, proposicoesAfetadas: [] } },
    [urlVotosCamara('2382675-97')]: { dados: [] },
    [urlVotacaoCamara('2382675-97')]: fixture('camara-votacao-2382675-97.json'),
  });

  it('falha pontual (ex.: HTTP 500 persistente) tira só aquela votação da rodada, com aviso', async () => {
    const cliente = clienteFalso(rotasDeUmaVotacao('2633410-8', new ErroHttp(500, urlVotosCamara('2633410-8'))));
    const coleta = await coletarCamara(cliente, '2026-06-17', '2026-06-17');
    expect(coleta.votacoes.map((v) => v.id)).toEqual(['camara:2382675-97']);
    expect(coleta.avisos).toContainEqual(expect.objectContaining({ tipo: 'falha_coleta', votacaoId: 'camara:2633410-8' }));
  });

  it('formato novo da API interrompe a coleta inteira', async () => {
    const cliente = clienteFalso(rotasDeUmaVotacao('2633410-8', { dados: [{ tipoVoto: 1 }] }));
    await expect(coletarCamara(cliente, '2026-06-17', '2026-06-17')).rejects.toThrow(/Formato inesperado/);
  });
});
