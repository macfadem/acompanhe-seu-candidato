import type { Coleta } from './tipos.js';

/** Linhas no formato das tabelas de supabase/migrations (snake_case). */
export interface LinhasBanco {
  parlamentar: Array<{
    id: string;
    casa: string;
    id_casa: string;
    nome: string;
    partido: string | null;
    uf: string | null;
    referencia_data: string;
  }>;
  votacao: Array<{
    id: string;
    casa: string;
    id_casa: string;
    data: string;
    data_hora: string | null;
    orgao: string;
    descricao: string;
    resultado: string;
    secreta: boolean;
    nominal: boolean;
    proposicao_sigla: string | null;
    proposicao_numero: string | null;
    proposicao_ano: number | null;
    proposicao_ementa: string | null;
    proposicao_id_casa: string | null;
    proposicao_url: string | null;
    placar_sim: number | null;
    placar_nao: number | null;
    placar_abstencao: number | null;
    url_fonte: string;
    url_api: string;
  }>;
  voto: Array<{
    votacao_id: string;
    parlamentar_id: string;
    categoria: string;
    valor_original: string | null;
    motivo: string | null;
    partido: string | null;
    uf: string | null;
  }>;
}

/** Ordem de gravação: parlamentar → votacao → voto (por causa das chaves estrangeiras). */
export function paraLinhasBanco(coleta: Coleta): LinhasBanco {
  return {
    parlamentar: coleta.parlamentares.map((p) => ({
      id: p.id,
      casa: p.casa,
      id_casa: p.idCasa,
      nome: p.nome,
      partido: p.partido,
      uf: p.uf,
      referencia_data: p.referenciaData,
    })),
    votacao: coleta.votacoes.map((v) => ({
      id: v.id,
      casa: v.casa,
      id_casa: v.idCasa,
      data: v.data,
      data_hora: v.dataHora,
      orgao: v.orgao,
      descricao: v.descricao,
      resultado: v.resultado,
      secreta: v.secreta,
      nominal: v.nominal,
      proposicao_sigla: v.proposicao?.sigla ?? null,
      proposicao_numero: v.proposicao?.numero ?? null,
      proposicao_ano: v.proposicao?.ano ?? null,
      proposicao_ementa: v.proposicao?.ementa ?? null,
      proposicao_id_casa: v.proposicao?.idCasa ?? null,
      proposicao_url: v.proposicao?.url ?? null,
      placar_sim: v.placar?.sim ?? null,
      placar_nao: v.placar?.nao ?? null,
      placar_abstencao: v.placar?.abstencao ?? null,
      url_fonte: v.urlFonte,
      url_api: v.urlApi,
    })),
    voto: coleta.votos.map((v) => ({
      votacao_id: v.votacaoId,
      parlamentar_id: v.parlamentarId,
      categoria: v.categoria,
      valor_original: v.valorOriginal,
      motivo: v.motivo,
      partido: v.partido,
      uf: v.uf,
    })),
  };
}
