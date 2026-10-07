/**
 * Levar a colinha para outro aparelho sem passar pelo servidor.
 *
 * O link usa o fragmento (`#c=...`): navegadores não enviam o fragmento ao servidor
 * nem no Referer. Cuidados no app:
 * - depois de importar, apagar o fragmento da barra de endereço (`urlSemFragmento` +
 *   `history.replaceState`), para não ficar no histórico nem em capturas de tela;
 * - a ferramenta de analytics e a de erros não podem registrar `location.hash`.
 */
import type { Colinha, Resultado } from './colinha.js';
import { codificar, decodificar } from './codificacao.js';

const PREFIXO = 'c=';

/** Link para abrir a colinha em outro aparelho. Nunca põe dados em `?query`. */
export function linkDeExportacao(enderecoDoApp: string, colinha: Colinha): string {
  const url = new URL(enderecoDoApp);
  url.search = '';
  url.hash = `${PREFIXO}${codificar(colinha)}`;
  return url.toString();
}

/**
 * Lê a colinha de `location.hash`. Devolve null quando o fragmento não é de colinha
 * (o app segue normalmente) e um erro amigável quando é, mas está quebrado.
 */
export function lerDoFragmento(hash: string): Resultado<Colinha> | null {
  const fragmento = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!fragmento.startsWith(PREFIXO)) return null;
  return decodificar(fragmento.slice(PREFIXO.length));
}

/** A mesma URL sem o fragmento, para usar com `history.replaceState` depois de importar. */
export function urlSemFragmento(href: string): string {
  const url = new URL(href);
  url.hash = '';
  return url.toString();
}
