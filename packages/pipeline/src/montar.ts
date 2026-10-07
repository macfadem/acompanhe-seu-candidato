import type { Classificacao } from './categorias.js';
import type { Aviso, Casa, Parlamentar, Voto } from './tipos.js';

/** Voto já lido da API de uma das casas, antes de virar o modelo comum. */
export interface VotoBruto {
  idCasa: string;
  nome: string;
  partido: string | null;
  uf: string | null;
  /** null quando a fonte não informa o voto. */
  valorOriginal: string | null;
  motivo: string | null;
  classificacao: Classificacao;
}

/** Converte os votos de uma votação, avisando sobre códigos desconhecidos e duplicidades. */
export function montarVotos(
  casa: Casa,
  votacaoId: string,
  data: string,
  brutos: readonly VotoBruto[],
): { votos: Voto[]; parlamentares: Parlamentar[]; avisos: Aviso[] } {
  const votos = new Map<string, Voto>();
  const parlamentares = new Map<string, Parlamentar>();
  const avisos: Aviso[] = [];
  const desconhecidos = new Set<string | null>();

  for (const b of brutos) {
    const parlamentarId = `${casa}:${b.idCasa}`;
    if (votos.has(parlamentarId)) {
      avisos.push({
        tipo: 'voto_duplicado',
        votacaoId,
        detalhe: `${parlamentarId} aparece mais de uma vez; ficou o último registro`,
      });
    }
    if (!b.classificacao.conhecido) desconhecidos.add(b.valorOriginal);
    votos.set(parlamentarId, {
      votacaoId,
      parlamentarId,
      categoria: b.classificacao.categoria,
      valorOriginal: b.valorOriginal,
      motivo: b.motivo,
      partido: b.partido,
      uf: b.uf,
    });
    parlamentares.set(parlamentarId, {
      id: parlamentarId,
      casa,
      idCasa: b.idCasa,
      nome: b.nome,
      partido: b.partido,
      uf: b.uf,
      referenciaData: data,
    });
  }

  for (const codigo of desconhecidos) {
    avisos.push({
      tipo: 'codigo_voto_desconhecido',
      votacaoId,
      detalhe:
        codigo === null
          ? 'voto vazio (null) numa votação que não parece secreta — revisar'
          : `valor "${codigo}" ainda não mapeado — revisar categorias.ts`,
    });
  }
  return { votos: [...votos.values()], parlamentares: [...parlamentares.values()], avisos };
}

/** Texto vazio vira null; o resto é aparado. */
export function limpar(texto: string | null | undefined): string | null {
  const t = texto?.trim();
  return t ? t : null;
}
