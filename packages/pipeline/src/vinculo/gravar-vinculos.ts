import { type ConexaoSql, emLotes } from '../gravar.js';
import type { Vinculo } from './casar.js';

/**
 * Substitui os vínculos dos candidatos do ano numa transação (tudo ou nada). As listas
 * oficiais já foram conferidas antes (tamanho mínimo), então uma resposta incompleta
 * nunca chega aqui para apagar vínculos.
 */
export async function gravarVinculos(
  db: ConexaoSql,
  ano: number,
  vinculos: readonly Vinculo[],
): Promise<{ antes: number; depois: number }> {
  await db.query('begin');
  try {
    const { rows } = await db.query(
      `delete from public.vinculo_parlamentar
        where sq_candidato in (select sq_candidato from public.candidato_tse where ano = $1)
        returning sq_candidato`,
      [ano],
    );
    const linhas = vinculos.map((v) => ({
      sq_candidato: v.sqCandidato,
      parlamentar_id: v.parlamentarId,
      casa: v.casa,
      metodo: v.metodo,
    }));
    await emLotes(db, 'vinculo_parlamentar', linhas, '', 1000);
    await db.query('commit');
    return { antes: rows.length, depois: linhas.length };
  } catch (erro) {
    await db.query('rollback');
    throw erro;
  }
}
