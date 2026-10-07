import { paraLinhasBanco } from './linhas.js';
import type { Coleta } from './tipos.js';

/**
 * O mínimo que a gravação precisa de uma conexão Postgres. Serve tanto para o
 * PGlite (testes) quanto para um driver de verdade (ex.: `pg`) — a escolha do
 * driver é uma decisão em aberto. A conexão precisa ser única (não um pool),
 * para que BEGIN/COMMIT valham para todas as consultas.
 */
export interface ConexaoSql {
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
}

export interface ResultadoGravacao {
  parlamentares: number;
  votacoesNovas: number;
  votacoesAtualizadas: number;
  /** Já estavam no banco com votos individuais e vieram sem (ex.: 404 passageiro): mantidas. */
  votacoesMantidas: number;
  votos: number;
}

type Linha = Record<string, unknown>;

/** Postgres aceita no máximo 65.535 parâmetros por comando. */
const LIMITE_PARAMETROS = 60_000;

function lotes<T>(itens: readonly T[], tamanho: number): T[][] {
  const resultado: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) resultado.push(itens.slice(i, i + tamanho));
  return resultado;
}

/** Monta `insert ... values (...), (...)` com parâmetros numerados. */
function insertMultiplo(tabela: string, colunas: readonly string[], linhas: readonly Linha[]) {
  const params: unknown[] = [];
  const valores = linhas.map((linha) => {
    const marcadores = colunas.map((coluna) => {
      params.push(linha[coluna] ?? null);
      return `$${params.length}`;
    });
    return `(${marcadores.join(', ')})`;
  });
  return { sql: `insert into public.${tabela} (${colunas.join(', ')}) values ${valores.join(', ')}`, params };
}

async function emLotes(
  db: ConexaoSql,
  tabela: string,
  linhas: readonly Linha[],
  sufixo: string,
  tamanhoLote: number,
): Promise<unknown[]> {
  const primeira = linhas[0];
  if (!primeira) return [];
  const colunas = Object.keys(primeira);
  const tamanho = Math.max(1, Math.min(tamanhoLote, Math.floor(LIMITE_PARAMETROS / colunas.length)));
  const retornadas: unknown[] = [];
  for (const lote of lotes(linhas, tamanho)) {
    const { sql, params } = insertMultiplo(tabela, colunas, lote);
    const { rows } = await db.query(`${sql} ${sufixo}`, params);
    retornadas.push(...rows);
  }
  return retornadas;
}

const ATUALIZA_PARLAMENTAR = `
  on conflict (id) do update set
    nome = excluded.nome,
    partido = excluded.partido,
    uf = excluded.uf,
    referencia_data = excluded.referencia_data,
    atualizado_em = now()
  where excluded.referencia_data >= public.parlamentar.referencia_data`;

const ATUALIZA_VOTACAO = `
  on conflict (id) do update set
    data = excluded.data,
    data_hora = excluded.data_hora,
    orgao = excluded.orgao,
    descricao = excluded.descricao,
    resultado = excluded.resultado,
    secreta = excluded.secreta,
    nominal = excluded.nominal,
    proposicao_sigla = excluded.proposicao_sigla,
    proposicao_numero = excluded.proposicao_numero,
    proposicao_ano = excluded.proposicao_ano,
    proposicao_ementa = excluded.proposicao_ementa,
    proposicao_id_casa = excluded.proposicao_id_casa,
    proposicao_url = excluded.proposicao_url,
    placar_sim = excluded.placar_sim,
    placar_nao = excluded.placar_nao,
    placar_abstencao = excluded.placar_abstencao,
    url_fonte = excluded.url_fonte,
    url_api = excluded.url_api,
    coletado_em = now()
  where excluded.nominal or not public.votacao.nominal
  returning (xmax = 0) as nova`;

/**
 * Grava uma coleta numa única transação (tudo ou nada) e pode ser repetida sem duplicar nada:
 * - parlamentar: atualiza nome/partido/UF só com dado de data igual ou mais recente;
 * - votação: atualiza, mas nunca rebaixa uma votação com votos individuais para "sem votos";
 * - voto: substitui os votos de cada votação nominal recebida (correções da fonte entram).
 */
export async function gravarColeta(
  db: ConexaoSql,
  coleta: Coleta,
  opcoes: { tamanhoLote?: number } = {},
): Promise<ResultadoGravacao> {
  const tamanhoLote = opcoes.tamanhoLote ?? 1000;
  const linhas = paraLinhasBanco(coleta);
  const nominais = new Set(coleta.votacoes.filter((v) => v.nominal).map((v) => v.id));
  const votosNovos = linhas.voto.filter((v) => nominais.has(v.votacao_id));

  await db.query('begin');
  try {
    await emLotes(db, 'parlamentar', linhas.parlamentar, ATUALIZA_PARLAMENTAR, tamanhoLote);
    const retorno = (await emLotes(db, 'votacao', linhas.votacao, ATUALIZA_VOTACAO, tamanhoLote)) as Array<{
      nova: boolean;
    }>;
    if (nominais.size > 0) {
      await db.query('delete from public.voto where votacao_id = any($1::text[])', [[...nominais]]);
    }
    await emLotes(db, 'voto', votosNovos, '', tamanhoLote);
    await db.query('commit');

    const novas = retorno.filter((r) => r.nova).length;
    return {
      parlamentares: linhas.parlamentar.length,
      votacoesNovas: novas,
      votacoesAtualizadas: retorno.length - novas,
      votacoesMantidas: linhas.votacao.length - retorno.length,
      votos: votosNovos.length,
    };
  } catch (erro) {
    await db.query('rollback');
    throw erro;
  }
}
