import { chave } from './texto.js';
import type { CategoriaVoto, Placar } from './tipos.js';

// Formatos vistos nos textos oficiais:
// "Sim: 273; Não: 160; Abstenção: 4" (Câmara), "Sim - 58, Não - 1" e "sim: 51; não: 17; abstenção: 1" (Senado).
const PADRAO = /\b(sim|nao|abstencao|abstencoes)\s*[:\-–—]\s*(\d+)/g;

/**
 * Extrai o placar de um texto oficial. Devolve null se não houver placar ou se houver
 * mais de um (ex.: texto que relata duas votações) — nesse caso não dá para conferir.
 */
export function placarDoTexto(texto: string | null | undefined): Placar | null {
  if (!texto) return null;
  const achados: Record<keyof Placar, number[]> = { sim: [], nao: [], abstencao: [] };
  for (const m of chave(texto).matchAll(PADRAO)) {
    const rotulo = m[1] ?? '';
    const campo: keyof Placar = rotulo.startsWith('abst') ? 'abstencao' : rotulo === 'sim' ? 'sim' : 'nao';
    achados[campo].push(Number(m[2]));
  }
  const [sim] = achados.sim;
  const [nao] = achados.nao;
  if (achados.sim.length !== 1 || achados.nao.length !== 1 || achados.abstencao.length > 1) return null;
  if (sim === undefined || nao === undefined) return null;
  return { sim, nao, abstencao: achados.abstencao[0] ?? 0 };
}

export function contarPlacar(votos: ReadonlyArray<{ categoria: CategoriaVoto }>): Placar {
  const placar: Placar = { sim: 0, nao: 0, abstencao: 0 };
  for (const { categoria } of votos) {
    if (categoria === 'sim' || categoria === 'nao' || categoria === 'abstencao') placar[categoria] += 1;
  }
  return placar;
}

export function placaresIguais(a: Placar, b: Placar): boolean {
  return a.sim === b.sim && a.nao === b.nao && a.abstencao === b.abstencao;
}

export function formatarPlacar(p: Placar): string {
  return `sim ${p.sim}, não ${p.nao}, abstenção ${p.abstencao}`;
}
