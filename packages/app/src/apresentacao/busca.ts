import type { Parlamentar } from '@acompanhe/pipeline/tipos';
import { UFS } from './ufs';

/** "João  D'Ávila" → "joao d'avila": sem acento, minúsculas, espaços simples. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export const MINIMO_DA_BUSCA = 2;

/**
 * Busca por nome (todas as palavras, em qualquer ordem, com ou sem acento), por sigla ou nome
 * da UF e por sigla do partido. Mantém a ordem da lista recebida. Menos de 2 letras: nada.
 */
export function buscarParlamentares<T extends Pick<Parlamentar, 'nome' | 'partido' | 'uf'>>(
  lista: readonly T[],
  consulta: string,
): T[] {
  const q = normalizar(consulta);
  if (q.length < MINIMO_DA_BUSCA) return [];

  const ufPeloNome = UFS.find(([, nome]) => normalizar(nome) === q)?.[0];
  const palavras = q.split(' ');

  return lista.filter((p) => {
    if (p.uf !== null && (normalizar(p.uf) === q || p.uf === ufPeloNome)) return true;
    if (p.partido !== null && normalizar(p.partido) === q) return true;
    const nome = normalizar(p.nome);
    return palavras.every((palavra) => nome.includes(palavra));
  });
}
