import { z } from 'zod';
import { classificarVotoCamara } from './categorias.js';
import { janelasMensais } from './datas.js';
import { type ClienteHttp, ErroHttp, limitador } from './http.js';
import { coletaVazia, juntarColetas } from './juntar.js';
import { limpar, montarVotos } from './montar.js';
import { contarPlacar, formatarPlacar, placarDoTexto, placaresIguais } from './placar.js';
import type { Aviso, Coleta, Proposicao, Resultado, Votacao } from './tipos.js';
import { ErroFormato, validar } from './validar.js';

export const CAMARA_API = 'https://dadosabertos.camara.leg.br/api/v2';
/** id do órgão "Plenário" (siglaOrgao = PLEN). */
export const ID_PLENARIO_CAMARA = 180;
const ITENS_POR_PAGINA = 100;
const LIMITE_PAGINAS = 500;

// --- Formatos da API (só os campos usados; o resto é ignorado) ---

const Link = z.object({ rel: z.string(), href: z.string() });

export const VotacaoItemCamara = z.object({
  id: z.string(),
  data: z.string(),
  dataHoraRegistro: z.string().nullish(),
  siglaOrgao: z.string(),
  descricao: z.string().nullish(),
  aprovacao: z.number().nullish(),
  proposicaoObjeto: z.string().nullish(),
  uriProposicaoObjeto: z.string().nullish(),
});
export type VotacaoItemCamara = z.infer<typeof VotacaoItemCamara>;

export const RespostaListaCamara = z.object({
  dados: z.array(VotacaoItemCamara),
  links: z.array(Link).nullish(),
});

const ProposicaoAfetada = z.object({
  id: z.number(),
  siglaTipo: z.string(),
  numero: z.number(),
  ano: z.number(),
  ementa: z.string().nullish(),
});

export const RespostaDetalheCamara = z.object({
  dados: z.object({
    id: z.string(),
    proposicoesAfetadas: z.array(ProposicaoAfetada).nullish(),
  }),
});
export type DetalheCamara = z.infer<typeof RespostaDetalheCamara>['dados'];

const VotoCamara = z.object({
  tipoVoto: z.string(),
  deputado_: z.object({
    id: z.number(),
    nome: z.string(),
    siglaPartido: z.string().nullish(),
    siglaUf: z.string().nullish(),
  }),
});
export type VotoCamara = z.infer<typeof VotoCamara>;
export const RespostaVotosCamara = z.object({ dados: z.array(VotoCamara) });

// --- URLs ---

export function urlListaVotacoesCamara(de: string, ate: string): string {
  const params = new URLSearchParams({
    idOrgao: String(ID_PLENARIO_CAMARA),
    dataInicio: de,
    dataFim: ate,
    itens: String(ITENS_POR_PAGINA),
    ordem: 'ASC',
    ordenarPor: 'dataHoraRegistro',
  });
  return `${CAMARA_API}/votacoes?${params}`;
}
export const urlVotacaoCamara = (id: string) => `${CAMARA_API}/votacoes/${encodeURIComponent(id)}`;
export const urlVotosCamara = (id: string) => `${urlVotacaoCamara(id)}/votos`;
export const urlPaginaProposicaoCamara = (id: number | string) =>
  `https://www.camara.leg.br/propostas-legislativas/${id}`;

// --- Regras ---

export function proximaPagina(links: ReadonlyArray<{ rel: string; href: string }> | null | undefined): string | null {
  return links?.find((l) => l.rel === 'next')?.href ?? null;
}

const resultadoCamara = (aprovacao: number | null | undefined): Resultado =>
  aprovacao === 1 ? 'aprovada' : aprovacao === 0 ? 'rejeitada' : 'indefinido';

/**
 * Proposição principal da votação: a primeira "proposição afetada" (ex.: o PL), e não o
 * objeto votado (ex.: o requerimento de urgência). Sem isso, usa o objeto ("REQ 3557/2026").
 */
export function escolherProposicaoCamara(item: VotacaoItemCamara, detalhe: DetalheCamara | null): Proposicao | null {
  const afetada = detalhe?.proposicoesAfetadas?.[0];
  if (afetada) {
    return {
      sigla: afetada.siglaTipo,
      numero: String(afetada.numero),
      ano: afetada.ano,
      ementa: limpar(afetada.ementa),
      idCasa: String(afetada.id),
      url: urlPaginaProposicaoCamara(afetada.id),
    };
  }
  const m = item.proposicaoObjeto ? /^([A-Z]+)\s+(\d+)\/(\d{4})$/.exec(item.proposicaoObjeto.trim()) : null;
  if (!m?.[1] || !m[2] || !m[3]) return null;
  const id = item.uriProposicaoObjeto?.match(/\/proposicoes\/(\d+)$/)?.[1] ?? null;
  return {
    sigla: m[1],
    numero: m[2],
    ano: Number(m[3]),
    ementa: null,
    idCasa: id,
    url: id ? urlPaginaProposicaoCamara(id) : null,
  };
}

/** Converte uma votação de plenário da Câmara para o modelo comum. */
export function normalizarVotacaoCamara(
  item: VotacaoItemCamara,
  detalhe: DetalheCamara | null,
  votosFonte: readonly VotoCamara[],
): Coleta {
  const votacaoId = `camara:${item.id}`;
  const descricao = item.descricao?.trim() ?? '';
  const { votos, parlamentares, avisos } = montarVotos(
    'camara',
    votacaoId,
    item.data,
    votosFonte.map((v) => ({
      idCasa: String(v.deputado_.id),
      nome: v.deputado_.nome,
      partido: limpar(v.deputado_.siglaPartido),
      uf: limpar(v.deputado_.siglaUf),
      valorOriginal: v.tipoVoto,
      motivo: null,
      classificacao: classificarVotoCamara(v.tipoVoto),
    })),
  );

  const nominal = votos.length > 0;
  const placar = nominal ? contarPlacar(votos) : null;
  const oficial = placarDoTexto(descricao);
  if (placar && oficial && !placaresIguais(placar, oficial)) {
    avisos.push({
      tipo: 'placar_divergente',
      votacaoId,
      detalhe: `contado: ${formatarPlacar(placar)} × texto oficial: ${formatarPlacar(oficial)}`,
    });
  }

  const proposicao = escolherProposicaoCamara(item, detalhe);
  if (!proposicao) {
    avisos.push({ tipo: 'proposicao_nao_identificada', votacaoId, detalhe: descricao.slice(0, 160) });
  }

  const votacao: Votacao = {
    id: votacaoId,
    casa: 'camara',
    idCasa: item.id,
    data: item.data,
    dataHora: limpar(item.dataHoraRegistro),
    orgao: item.siglaOrgao,
    descricao,
    resultado: resultadoCamara(item.aprovacao),
    // A API não marca votação secreta (na Câmara ela é rara, ex.: eleição da Mesa).
    secreta: false,
    nominal,
    proposicao,
    placar,
    urlFonte: proposicao?.url ?? urlVotacaoCamara(item.id),
    urlApi: urlVotacaoCamara(item.id),
  };
  return { votacoes: [votacao], parlamentares, votos, avisos };
}

// --- Coleta ---

/** Lista as votações de plenário no intervalo, seguindo a paginação. */
export async function listarVotacoesPlenarioCamara(
  cliente: ClienteHttp,
  de: string,
  ate: string,
): Promise<VotacaoItemCamara[]> {
  const itens = new Map<string, VotacaoItemCamara>();
  for (const janela of janelasMensais(de, ate)) {
    let url: string | null = urlListaVotacoesCamara(janela.de, janela.ate);
    for (let pagina = 1; url; pagina++) {
      if (pagina > LIMITE_PAGINAS) throw new Error(`Paginação não terminou em ${url}`);
      const resposta = validar(RespostaListaCamara, await cliente.getJson(url), `lista de votações da Câmara (${url})`);
      for (const item of resposta.dados) {
        // O filtro idOrgao já traz só o plenário; este é um cinto de segurança.
        if (item.siglaOrgao === 'PLEN') itens.set(item.id, item);
      }
      url = proximaPagina(resposta.links);
    }
  }
  return [...itens.values()];
}

async function buscarOuNulo<S extends z.ZodType>(
  cliente: ClienteHttp,
  url: string,
  schema: S,
  contexto: string,
): Promise<z.output<S> | null> {
  try {
    return validar(schema, await cliente.getJson(url), contexto);
  } catch (erro) {
    if (erro instanceof ErroHttp && erro.status === 404) return null;
    throw erro;
  }
}

async function coletarVotacaoCamara(cliente: ClienteHttp, item: VotacaoItemCamara): Promise<Coleta> {
  const votacaoId = `camara:${item.id}`;
  try {
    const avisos: Aviso[] = [];
    const votos = await buscarOuNulo(cliente, urlVotosCamara(item.id), RespostaVotosCamara, `votos ${item.id}`);
    if (!votos) avisos.push({ tipo: 'votos_indisponiveis', votacaoId, detalhe: 'HTTP 404 em /votos' });
    const detalhe = await buscarOuNulo(cliente, urlVotacaoCamara(item.id), RespostaDetalheCamara, `votação ${item.id}`);
    const coleta = normalizarVotacaoCamara(item, detalhe?.dados ?? null, votos?.dados ?? []);
    coleta.avisos.unshift(...avisos);
    return coleta;
  } catch (erro) {
    // Formato novo da API para tudo; falha pontual (rede, 5xx persistente) só tira esta votação
    // da rodada — a coleta seguinte (que olha os últimos 7 dias) tenta de novo.
    if (erro instanceof ErroFormato) throw erro;
    const motivo = erro instanceof Error ? erro.message : String(erro);
    return { ...coletaVazia(), avisos: [{ tipo: 'falha_coleta', votacaoId, detalhe: motivo }] };
  }
}

/**
 * Coleta as votações de plenário da Câmara, com votos e proposição principal.
 * Votação sem votos individuais = simbólica (normal: a maioria das votações é simbólica).
 */
export async function coletarCamara(cliente: ClienteHttp, de: string, ate: string, concorrencia = 3): Promise<Coleta> {
  const itens = await listarVotacoesPlenarioCamara(cliente, de, ate);
  const limitar = limitador(concorrencia);
  const partes = await Promise.all(itens.map((item) => limitar(() => coletarVotacaoCamara(cliente, item))));
  return juntarColetas(...partes);
}
