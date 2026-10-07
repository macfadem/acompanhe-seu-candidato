/**
 * Guarda a colinha só no aparelho (localStorage). Tudo aqui tolera falhas: em aba
 * anônima ou com armazenamento bloqueado, o app funciona em memória e avisa a pessoa.
 */
import { type Colinha, validarColinha } from './colinha.js';

export const CHAVE = 'acompanhe-seu-candidato:colinha';

/** O pedaço do `Storage` do navegador que usamos (facilita testar). */
export interface ArmazenamentoSimples {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
  removeItem(chave: string): void;
}

export type EstadoCarregamento =
  | { estado: 'ok'; colinha: Colinha }
  | { estado: 'vazio' }
  | { estado: 'indisponivel' }
  /** Havia algo salvo, mas quebrado: o app pode oferecer recomeçar. */
  | { estado: 'invalido' };

/** O localStorage, se existir e aceitar escrita; senão null. */
export function armazenamentoDoNavegador(): ArmazenamentoSimples | null {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    const teste = `${CHAVE}:teste`;
    s.setItem(teste, '1');
    s.removeItem(teste);
    return s;
  } catch {
    return null;
  }
}

export function carregar(armazenamento: ArmazenamentoSimples | null): EstadoCarregamento {
  if (!armazenamento) return { estado: 'indisponivel' };
  let texto: string | null;
  try {
    texto = armazenamento.getItem(CHAVE);
  } catch {
    return { estado: 'indisponivel' };
  }
  if (texto === null) return { estado: 'vazio' };
  try {
    const r = validarColinha(JSON.parse(texto));
    return r.ok ? { estado: 'ok', colinha: r.valor } : { estado: 'invalido' };
  } catch {
    return { estado: 'invalido' };
  }
}

/** true se gravou; false se o armazenamento não está disponível (ex.: cota cheia, modo privado). */
export function salvar(armazenamento: ArmazenamentoSimples | null, colinha: Colinha): boolean {
  if (!armazenamento) return false;
  try {
    armazenamento.setItem(CHAVE, JSON.stringify(colinha));
    return true;
  } catch {
    return false;
  }
}

export function apagar(armazenamento: ArmazenamentoSimples | null): boolean {
  if (!armazenamento) return false;
  try {
    armazenamento.removeItem(CHAVE);
    return true;
  } catch {
    return false;
  }
}
