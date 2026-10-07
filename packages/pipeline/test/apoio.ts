import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ClienteHttp } from '../src/http.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ_REPO = path.resolve(AQUI, '../../..');

/** Lê uma fixture (resposta real das APIs) de test/fixtures. */
export function fixture(nome: string): unknown {
  return JSON.parse(readFileSync(path.join(AQUI, 'fixtures', nome), 'utf8')) as unknown;
}

export interface ClienteFalso extends ClienteHttp {
  chamadas: string[];
  maxSimultaneas: number;
}

/**
 * Cliente HTTP falso: responde por URL exata. Um Error na rota é lançado (simula falha);
 * URL não prevista falha o teste. `atrasoMs` permite medir concorrência.
 */
export function clienteFalso(rotas: Record<string, unknown>, atrasoMs = 0): ClienteFalso {
  let ativas = 0;
  const cliente: ClienteFalso = {
    chamadas: [],
    maxSimultaneas: 0,
    async getJson(url: string) {
      cliente.chamadas.push(url);
      ativas += 1;
      cliente.maxSimultaneas = Math.max(cliente.maxSimultaneas, ativas);
      try {
        if (atrasoMs > 0) await new Promise((r) => setTimeout(r, atrasoMs));
        if (!Object.hasOwn(rotas, url)) throw new Error(`URL não prevista no teste: ${url}`);
        const resposta = rotas[url];
        if (resposta instanceof Error) throw resposta;
        return structuredClone(resposta);
      } finally {
        ativas -= 1;
      }
    },
  };
  return cliente;
}
