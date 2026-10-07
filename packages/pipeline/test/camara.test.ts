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

describe('Câmara — aviso de proposição não identificada', () => {
  // Forma real vista na coleta de jul–out/2026: registro de plenário sem votos e sem proposição afetada.
  const registro: VotacaoItemCamara = {
    id: '9999999-3',
    data: '2026-08-12',
    dataHoraRegistro: null,
    siglaOrgao: 'PLEN',
    descricao: 'Alteração do Regime de Tramitação desta proposição em virtude da Aprovação do REQ 3803/2026.',
    aprovacao: null,
    proposicaoObjeto: null,
    uriProposicaoObjeto: null,
  };

  it('registro sem votos (ex.: alteração de regime de tramitação) não gera aviso', () => {
    const coleta = normalizarVotacaoCamara(registro, null, []);
    expect(coleta.votacoes[0]?.proposicao).toBeNull();
    expect(coleta.avisos).toEqual([]);
  });

  it('votação com voto individual sem proposição identificável gera aviso', () => {
    const coleta = normalizarVotacaoCamara(registro, null, votosTrecho);
    expect(coleta.avisos.map((a) => a.tipo)).toEqual(['proposicao_nao_identificada']);
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

describe('Câmara — votação secreta', () => {
  // Caso real (coleta de 07/10/2026): votação 2645346-18, PDL 995/2026 (escolha de ministro do
  // TCU), 02/09/2026. Todos os 466 registros vieram com tipoVoto null. Os números e a forma do
  // texto são os reais; os deputados abaixo são fictícios (só a participação é pública).
  const itemSecreta: VotacaoItemCamara = {
    id: '2645346-18',
    data: '2026-09-02',
    dataHoraRegistro: '2026-09-02T13:53:25',
    siglaOrgao: 'PLEN',
    descricao: 'Aprovado o Projeto de Decreto Legislativo nº 995, de 2026 (escolha de Ministro do Tribunal de Contas da União). Sim: 404; Não: 61; Abstenção: 1; Total: 466.',
    aprovacao: 1,
    proposicaoObjeto: 'PDL 995/2026',
    uriProposicaoObjeto: null,
  };
  const participantes = (n: number): VotoCamara[] =>
    Array.from({ length: n }, (_, i) => ({
      tipoVoto: null,
      deputado_: { id: 900_000 + i, nome: `Deputado Fictício ${i}`, siglaPartido: 'PARTIDO', siglaUf: 'DF' },
    }));

  it('a API aceita tipoVoto null (antes isso parava a coleta)', () => {
    expect(() => validar(RespostaVotosCamara, { dados: participantes(3) }, 'votos')).not.toThrow();
  });

  it('todos os votos null: votação secreta, voto "secreto" e placar do texto oficial', () => {
    const coleta = normalizarVotacaoCamara(itemSecreta, null, participantes(466));
    expect(coleta.avisos).toEqual([]);
    expect(coleta.votacoes[0]).toMatchObject({
      secreta: true,
      nominal: true,
      resultado: 'aprovada',
      placar: { sim: 404, nao: 61, abstencao: 1 },
      proposicao: { sigla: 'PDL', numero: '995', ano: 2026 },
    });
    expect(coleta.votos).toHaveLength(466);
    expect(new Set(coleta.votos.map((v) => v.categoria))).toEqual(new Set(['secreto']));
    expect(coleta.votos.every((v) => v.valorOriginal === null)).toBe(true);
  });

  it('número de participantes diferente da soma oficial gera aviso', () => {
    const coleta = normalizarVotacaoCamara(itemSecreta, null, participantes(465));
    expect(coleta.avisos).toEqual([
      expect.objectContaining({ tipo: 'placar_divergente', detalhe: expect.stringContaining('465 registros') }),
    ]);
  });

  it('voto null só para alguns (votação aberta) vira "outro" e gera aviso', () => {
    const votos: VotoCamara[] = votosTrecho.map((v, i) => (i === 0 ? { ...v, tipoVoto: null } : v));
    const coleta = normalizarVotacaoCamara(item('2633410-8'), null, votos);
    expect(coleta.votacoes[0]?.secreta).toBe(false);
    expect(coleta.votos[0]).toMatchObject({ categoria: 'outro', valorOriginal: null });
    expect(coleta.avisos).toContainEqual(
      expect.objectContaining({ tipo: 'codigo_voto_desconhecido', detalhe: expect.stringContaining('vazio') }),
    );
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

  it('formato inesperado numa votação: só ela fica de fora, com o problema resumido', async () => {
    const quebrados = { dados: Array.from({ length: 50 }, () => ({ tipoVoto: 1 })) };
    const cliente = clienteFalso(rotasDeUmaVotacao('2633410-8', quebrados));
    const coleta = await coletarCamara(cliente, '2026-06-17', '2026-06-17');
    expect(coleta.votacoes.map((v) => v.id)).toEqual(['camara:2382675-97']);
    const aviso = coleta.avisos.find((a) => a.tipo === 'formato_inesperado');
    expect(aviso?.votacaoId).toBe('camara:2633410-8');
    expect(aviso?.detalhe).toMatch(/dados\[\*\]\.tipoVoto: .* — 50 ocorrências/);
    expect(aviso?.detalhe.split('\n').length).toBeLessThan(6); // 50 problemas iguais = poucas linhas
  });

  it('formato novo na lista de votações interrompe a coleta inteira', async () => {
    const cliente = clienteFalso({
      [urlListaVotacoesCamara('2026-06-17', '2026-06-17')]: { dados: [{ id: 1 }], links: [] },
    });
    await expect(coletarCamara(cliente, '2026-06-17', '2026-06-17')).rejects.toThrow(/Formato inesperado/);
  });
});
