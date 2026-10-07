import { z } from 'zod';
import { classificarVotoSenado } from './categorias.js';
import { janelasMensais } from './datas.js';
import type { ClienteHttp } from './http.js';
import { juntarColetas } from './juntar.js';
import { limpar, montarVotos } from './montar.js';
import { contarPlacar, formatarPlacar, placarDoTexto, placaresIguais } from './placar.js';
import type { Aviso, Coleta, Placar, Proposicao, Resultado, Votacao } from './tipos.js';
import { resumirErros, validar } from './validar.js';

export const SENADO_API = 'https://legis.senado.leg.br/dadosabertos';

// --- Formato da API (resposta é um array na raiz, com os votos embutidos) ---

const VotoSenado = z.object({
  codigoParlamentar: z.number(),
  nomeParlamentar: z.string(),
  siglaPartidoParlamentar: z.string().nullish(),
  siglaUFParlamentar: z.string().nullish(),
  siglaVotoParlamentar: z.string(),
  descricaoVotoParlamentar: z.string().nullish(),
});

export const VotacaoSenado = z.object({
  codigoSessaoVotacao: z.number(),
  codigoMateria: z.number().nullish(),
  dataSessao: z.string(),
  sigla: z.string().nullish(),
  numero: z.union([z.string(), z.number()]).nullish(),
  /** Ano da matéria (não da sessão). */
  ano: z.number().nullish(),
  identificacao: z.string().nullish(),
  ementa: z.string().nullish(),
  descricaoVotacao: z.string().nullish(),
  resultadoVotacao: z.string().nullish(),
  votacaoSecreta: z.string().nullish(),
  totalVotosSim: z.number().nullish(),
  totalVotosNao: z.number().nullish(),
  totalVotosAbstencao: z.number().nullish(),
  informeLegislativo: z
    .object({ texto: z.string().nullish(), siglaColegiado: z.string().nullish() })
    .nullish(),
  votos: z.array(VotoSenado).nullish(),
});
export type VotacaoSenado = z.infer<typeof VotacaoSenado>;
export const RespostaVotacoesSenado = z.array(VotacaoSenado);

// --- URLs ---

export function urlVotacoesSenado(de: string, ate: string): string {
  return `${SENADO_API}/votacao?${new URLSearchParams({ dataInicio: de, dataFim: ate })}`;
}
export const urlPaginaMateriaSenado = (codigo: number | string) =>
  `https://www25.senado.leg.br/web/atividade/materias/-/materia/${codigo}`;

// --- Regras ---

const resultadoSenado = (codigo: string | null | undefined): Resultado =>
  codigo === 'A' ? 'aprovada' : codigo === 'R' ? 'rejeitada' : 'indefinido';

function proposicaoSenado(v: VotacaoSenado): Proposicao | null {
  const sigla = limpar(v.sigla);
  const numero = v.numero === null || v.numero === undefined ? null : limpar(String(v.numero));
  if (!sigla || !numero) return null;
  const codigo = v.codigoMateria ?? null;
  return {
    sigla,
    numero,
    ano: v.ano ?? null,
    ementa: limpar(v.ementa),
    idCasa: codigo === null ? null : String(codigo),
    url: codigo === null ? null : urlPaginaMateriaSenado(codigo),
  };
}

/** Converte uma votação do Senado para o modelo comum. Devolve null se não for de plenário. */
export function normalizarVotacaoSenado(v: VotacaoSenado): Coleta | null {
  const colegiado = limpar(v.informeLegislativo?.siglaColegiado);
  if (colegiado && colegiado !== 'PLEN') return null; // MVP: só plenário

  const votacaoId = `senado:${v.codigoSessaoVotacao}`;
  const secreta = v.votacaoSecreta === 'S';
  const { votos, parlamentares, avisos } = montarVotos(
    'senado',
    votacaoId,
    v.dataSessao,
    (v.votos ?? []).map((x) => ({
      idCasa: String(x.codigoParlamentar),
      nome: x.nomeParlamentar,
      partido: limpar(x.siglaPartidoParlamentar),
      uf: limpar(x.siglaUFParlamentar),
      valorOriginal: x.siglaVotoParlamentar,
      motivo: limpar(x.descricaoVotoParlamentar),
      classificacao: classificarVotoSenado(x.siglaVotoParlamentar, x.descricaoVotoParlamentar),
    })),
  );

  if (!colegiado) {
    avisos.push({ tipo: 'orgao_nao_informado', votacaoId, detalhe: 'informeLegislativo sem siglaColegiado' });
  }

  const nominal = votos.length > 0;
  let placar: Placar | null = null;
  if (secreta) {
    // Na votação secreta só os totais são públicos; o voto individual vem como "Votou".
    if (v.totalVotosSim != null && v.totalVotosNao != null) {
      placar = { sim: v.totalVotosSim, nao: v.totalVotosNao, abstencao: v.totalVotosAbstencao ?? 0 };
      const participantes = votos.filter((x) => x.categoria === 'secreto').length;
      const soma = placar.sim + placar.nao + placar.abstencao;
      if (nominal && participantes !== soma) {
        avisos.push({
          tipo: 'placar_divergente',
          votacaoId,
          detalhe: `${participantes} registros "Votou" × soma dos totais oficiais ${soma}`,
        });
      }
    }
  } else if (nominal) {
    // Em votação aberta os totais vêm null: conta-se a partir dos votos.
    placar = contarPlacar(votos);
  }

  const oficial = placarDoTexto(v.informeLegislativo?.texto);
  if (placar && oficial && !placaresIguais(placar, oficial)) {
    avisos.push({
      tipo: 'placar_divergente',
      votacaoId,
      detalhe: `usado: ${formatarPlacar(placar)} × texto oficial: ${formatarPlacar(oficial)}`,
    });
  }

  const proposicao = proposicaoSenado(v);
  if (!proposicao) {
    avisos.push({ tipo: 'proposicao_nao_identificada', votacaoId, detalhe: limpar(v.identificacao) ?? '' });
  }

  const urlApi = `${SENADO_API}/votacao?${new URLSearchParams({ dataInicio: v.dataSessao, dataFim: v.dataSessao })}`;
  const votacao: Votacao = {
    id: votacaoId,
    casa: 'senado',
    idCasa: String(v.codigoSessaoVotacao),
    data: v.dataSessao,
    dataHora: null,
    orgao: colegiado ?? 'nao_informado',
    descricao: limpar(v.descricaoVotacao) ?? limpar(v.identificacao) ?? '',
    resultado: resultadoSenado(v.resultadoVotacao),
    secreta,
    nominal,
    proposicao,
    placar,
    urlFonte: proposicao?.url ?? urlApi,
    urlApi,
  };
  return { votacoes: [votacao], parlamentares, votos, avisos };
}

/** Converte a resposta da API (já validada) em uma coleta, ignorando votações de comissão. */
export function normalizarRespostaSenado(lista: readonly VotacaoSenado[]): Coleta {
  return juntarColetas(...lista.flatMap((v) => normalizarVotacaoSenado(v) ?? []));
}

/** Só o necessário para saber de que colegiado é um item, mesmo fora do formato. */
const ColegiadoSenado = z.object({
  codigoSessaoVotacao: z.unknown(),
  informeLegislativo: z.object({ siglaColegiado: z.string().nullish() }).nullish(),
});

/**
 * Valida votação por votação. A resposta tem de ser uma lista (senão a coleta para);
 * uma votação de plenário fora do formato fica de fora com aviso, e as outras seguem.
 */
export function lerRespostaSenado(bruto: unknown, contexto: string): { votacoes: VotacaoSenado[]; avisos: Aviso[] } {
  const lista = validar(z.array(z.unknown()), bruto ?? [], contexto);
  const votacoes: VotacaoSenado[] = [];
  const avisos: Aviso[] = [];
  for (const [i, item] of lista.entries()) {
    const lida = VotacaoSenado.safeParse(item);
    if (lida.success) {
      votacoes.push(lida.data);
      continue;
    }
    const cabecalho = ColegiadoSenado.safeParse(item);
    const colegiado = cabecalho.success ? limpar(cabecalho.data.informeLegislativo?.siglaColegiado) : null;
    if (colegiado && colegiado !== 'PLEN') continue; // comissão: fora do MVP de qualquer jeito
    const codigo = cabecalho.success ? cabecalho.data.codigoSessaoVotacao : undefined;
    avisos.push({
      tipo: 'formato_inesperado',
      votacaoId: typeof codigo === 'number' || typeof codigo === 'string' ? `senado:${codigo}` : `senado:item-${i}`,
      detalhe: `Formato inesperado em ${contexto}, item ${i}:\n${resumirErros(lida.error)}`,
    });
  }
  return { votacoes, avisos };
}

export async function coletarSenado(cliente: ClienteHttp, de: string, ate: string): Promise<Coleta> {
  const partes: Coleta[] = [];
  for (const janela of janelasMensais(de, ate)) {
    const url = urlVotacoesSenado(janela.de, janela.ate);
    const { votacoes, avisos } = lerRespostaSenado(await cliente.getJson(url), `votações do Senado (${url})`);
    const coleta = normalizarRespostaSenado(votacoes);
    coleta.avisos.push(...avisos);
    partes.push(coleta);
  }
  return juntarColetas(...partes);
}
