/**
 * Cliente HTTP mínimo para as APIs oficiais: timeout, novas tentativas com espera
 * exponencial (respeitando Retry-After) e limite de concorrência.
 * Só busca dados públicos — nunca envia dado de usuário.
 */

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export interface OpcoesHttp {
  /** Total de tentativas por requisição (padrão 5). */
  tentativas?: number;
  timeoutMs?: number;
  esperaBaseMs?: number;
  esperaMaxMs?: number;
  userAgent?: string;
  /** Injetáveis para teste. */
  fetchFn?: FetchFn;
  esperar?: (ms: number) => Promise<void>;
  aleatorio?: () => number;
}

export interface ClienteHttp {
  /** GET que devolve o JSON já decodificado (ou null se o corpo vier vazio). */
  getJson(url: string): Promise<unknown>;
}

export class ErroHttp extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`HTTP ${status} em ${url}`);
    this.name = 'ErroHttp';
  }
}

/** Status que costumam ser passageiros e merecem nova tentativa. */
const PASSAGEIROS = new Set([408, 425, 429, 500, 502, 503, 504]);

export const USER_AGENT_PADRAO = 'AcompanheSeuCandidato-pipeline/0.1 (dados abertos; projeto open source)';

/** Retry-After em segundos ou como data HTTP; devolve milissegundos. */
export function lerRetryAfter(valor: string | null, agora: number = Date.now()): number | null {
  if (!valor) return null;
  const segundos = Number(valor);
  if (Number.isFinite(segundos) && segundos >= 0) return segundos * 1000;
  const quando = Date.parse(valor);
  return Number.isNaN(quando) ? null : Math.max(0, quando - agora);
}

const dormir = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function criarCliente(opcoes: OpcoesHttp = {}): ClienteHttp {
  const {
    tentativas = 5,
    timeoutMs = 30_000,
    esperaBaseMs = 1_000,
    esperaMaxMs = 60_000,
    userAgent = USER_AGENT_PADRAO,
    fetchFn = (url, init) => fetch(url, init),
    esperar = dormir,
    aleatorio = Math.random,
  } = opcoes;

  // Espera exponencial com "jitter": 50% a 100% do valor, para não sincronizar tentativas.
  const espera = (tentativa: number) =>
    Math.min(esperaMaxMs, esperaBaseMs * 2 ** (tentativa - 1)) * (0.5 + aleatorio() / 2);

  return {
    async getJson(url: string): Promise<unknown> {
      for (let tentativa = 1; ; tentativa++) {
        let resposta: Response;
        try {
          resposta = await fetchFn(url, {
            headers: { Accept: 'application/json', 'User-Agent': userAgent },
            signal: AbortSignal.timeout(timeoutMs),
          });
        } catch (erro) {
          // Falha de rede ou timeout: tenta de novo enquanto houver tentativas.
          if (tentativa >= tentativas) {
            throw new Error(`Falha de rede em ${url} após ${tentativa} tentativas`, { cause: erro });
          }
          await esperar(espera(tentativa));
          continue;
        }

        if (resposta.ok) {
          const corpo = await resposta.text();
          if (!corpo.trim()) return null;
          try {
            return JSON.parse(corpo) as unknown;
          } catch (erro) {
            throw new Error(`Resposta não é JSON em ${url}`, { cause: erro });
          }
        }

        if (PASSAGEIROS.has(resposta.status) && tentativa < tentativas) {
          const pedido = lerRetryAfter(resposta.headers.get('retry-after'));
          await esperar(Math.min(esperaMaxMs, pedido ?? espera(tentativa)));
          continue;
        }
        throw new ErroHttp(resposta.status, url);
      }
    },
  };
}

/** Limita quantas tarefas assíncronas rodam ao mesmo tempo (a Câmara limita a taxa). */
export function limitador(maximo: number) {
  if (!Number.isInteger(maximo) || maximo < 1) throw new Error(`Concorrência inválida: ${maximo}`);
  let ativas = 0;
  const fila: Array<() => void> = [];

  const proxima = () => {
    if (ativas >= maximo) return;
    const iniciar = fila.shift();
    if (!iniciar) return;
    ativas += 1;
    iniciar();
  };

  return function limitar<T>(tarefa: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      fila.push(() => {
        Promise.resolve()
          .then(tarefa)
          .then(resolve, reject)
          .finally(() => {
            ativas -= 1;
            proxima();
          });
      });
      proxima();
    });
  };
}
