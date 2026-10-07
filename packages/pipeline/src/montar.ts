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
  /** Código desconhecido → descrição oficial (se houver), categoria usada e quantos registros. */
  const desconhecidos = new Map<string | null, { descricao: string | null; categoria: string; quantos: number }>();

  for (const b of brutos) {
    const parlamentarId = `${casa}:${b.idCasa}`;
    if (votos.has(parlamentarId)) {
      avisos.push({
        tipo: 'voto_duplicado',
        votacaoId,
        detalhe: `${parlamentarId} aparece mais de uma vez; ficou o último registro`,
      });
    }
    if (!b.classificacao.conhecido) {
      const atual = desconhecidos.get(b.valorOriginal);
      desconhecidos.set(b.valorOriginal, {
        descricao: atual?.descricao ?? b.motivo,
        categoria: b.classificacao.categoria,
        quantos: (atual?.quantos ?? 0) + 1,
      });
    }
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

  for (const [codigo, { descricao, categoria, quantos }] of desconhecidos) {
    const valor = codigo === null ? 'voto vazio (null) numa votação que não parece secreta' : `valor "${codigo}"`;
    const oficial = descricao ? ` (descrição oficial: "${descricao}")` : '';
    avisos.push({
      tipo: 'codigo_voto_desconhecido',
      votacaoId,
      detalhe: `${valor}${oficial} em ${quantos} registro(s), classificado como "${categoria}" — revisar categorias.ts`,
    });
  }
  return { votos: [...votos.values()], parlamentares: [...parlamentares.values()], avisos };
}

/** Texto vazio vira null; o resto é aparado. */
export function limpar(texto: string | null | undefined): string | null {
  const t = texto?.trim();
  return t ? t : null;
}
