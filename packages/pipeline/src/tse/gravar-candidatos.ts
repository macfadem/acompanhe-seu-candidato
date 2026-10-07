import { type ConexaoSql, emLotes } from '../gravar.js';
import type { CandidatoTse } from './candidatos.js';

export interface ResultadoCandidatos {
  novos: number;
  atualizados: number;
  /** Já estavam no banco com dado de um arquivo mais novo: mantidos. */
  mantidos: number;
}

/** Atualiza só com arquivo igual ou mais novo (o TSE regera o arquivo várias vezes por dia). */
const ATUALIZA_CANDIDATO = `
  on conflict (sq_candidato) do update set
    ano = excluded.ano,
    cargo = excluded.cargo,
    uf = excluded.uf,
    numero = excluded.numero,
    nome_urna = excluded.nome_urna,
    nome_civil = excluded.nome_civil,
    partido = excluded.partido,
    federacao = excluded.federacao,
    cd_situacao_totalizacao = excluded.cd_situacao_totalizacao,
    situacao_totalizacao = excluded.situacao_totalizacao,
    gerado_em_tse = excluded.gerado_em_tse,
    atualizado_em = now()
  where excluded.gerado_em_tse >= public.candidato_tse.gerado_em_tse
  returning (xmax = 0) as novo`;

/** Grava os candidatos numa transação (tudo ou nada); pode repetir sem duplicar. Não mexe em foto_url. */
export async function gravarCandidatos(
  db: ConexaoSql,
  candidatos: readonly CandidatoTse[],
  opcoes: { tamanhoLote?: number } = {},
): Promise<ResultadoCandidatos> {
  const linhas = candidatos.map((c) => ({
    sq_candidato: c.sqCandidato,
    ano: c.ano,
    cargo: c.cargo,
    uf: c.uf,
    numero: c.numero,
    nome_urna: c.nomeUrna,
    nome_civil: c.nomeCivil,
    partido: c.partido,
    federacao: c.federacao,
    cd_situacao_totalizacao: c.cdSituacaoTotalizacao,
    situacao_totalizacao: c.situacaoTotalizacao,
    gerado_em_tse: c.geradoEmTse,
  }));
  await db.query('begin');
  try {
    const retorno = (await emLotes(db, 'candidato_tse', linhas, ATUALIZA_CANDIDATO, opcoes.tamanhoLote ?? 1000)) as Array<{
      novo: boolean;
    }>;
    await db.query('commit');
    const novos = retorno.filter((r) => r.novo).length;
    return { novos, atualizados: retorno.length - novos, mantidos: linhas.length - retorno.length };
  } catch (erro) {
    await db.query('rollback');
    throw erro;
  }
}
