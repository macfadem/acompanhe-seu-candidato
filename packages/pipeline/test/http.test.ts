import { describe, expect, it, vi } from 'vitest';
import { criarCliente, ErroHttp, lerRetryAfter, limitador } from '../src/http.js';

const resposta = (status: number, corpo: string | null = null, headers: Record<string, string> = {}) =>
  new Response(corpo, { status, headers });

describe('criarCliente', () => {
  it('envia Accept e User-Agent e decodifica o JSON', async () => {
    const fetchFn = vi.fn(async (_url: string, _init?: RequestInit) => resposta(200, '{"ok":true}'));
    const cliente = criarCliente({ fetchFn });
    await expect(cliente.getJson('https://exemplo.gov.br/a')).resolves.toEqual({ ok: true });
    const init = fetchFn.mock.calls[0]?.[1];
    const headers = new Headers(init?.headers);
    expect(headers.get('accept')).toBe('application/json');
    expect(headers.get('user-agent')).toMatch(/AcompanheSeuCandidato/);
  });

  it('após HTTP 429, espera o tempo pedido em Retry-After e tenta de novo', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(resposta(429, null, { 'Retry-After': '2' }))
      .mockResolvedValueOnce(resposta(200, '[1,2]'));
    const esperar = vi.fn(async () => {});
    const cliente = criarCliente({ fetchFn, esperar });
    await expect(cliente.getJson('https://exemplo.gov.br/b')).resolves.toEqual([1, 2]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(esperar).toHaveBeenCalledWith(2000);
  });

  it('após falha de rede, espera de forma exponencial e tenta de novo', async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(resposta(200, '{}'));
    const esperar = vi.fn(async () => {});
    const cliente = criarCliente({ fetchFn, esperar, esperaBaseMs: 1000, aleatorio: () => 1 });
    await expect(cliente.getJson('https://exemplo.gov.br/c')).resolves.toEqual({});
    expect(esperar.mock.calls).toEqual([[1000], [2000]]);
  });

  it('não insiste em erro definitivo (HTTP 400)', async () => {
    const fetchFn = vi.fn(async () => resposta(400, '{"erro":"parametro"}'));
    const cliente = criarCliente({ fetchFn, esperar: async () => {} });
    const erro = await cliente.getJson('https://exemplo.gov.br/d').catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroHttp);
    expect((erro as ErroHttp).status).toBe(400);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('desiste depois do número máximo de tentativas', async () => {
    const fetchFn = vi.fn(async () => resposta(503));
    const esperar = vi.fn(async () => {});
    const cliente = criarCliente({ fetchFn, esperar, tentativas: 3 });
    await expect(cliente.getJson('https://exemplo.gov.br/e')).rejects.toMatchObject({ status: 503 });
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(esperar).toHaveBeenCalledTimes(2);
  });

  it('corpo vazio vira null; JSON inválido vira erro claro', async () => {
    const vazio = criarCliente({ fetchFn: async () => resposta(200, '') });
    await expect(vazio.getJson('https://exemplo.gov.br/f')).resolves.toBeNull();
    const quebrado = criarCliente({ fetchFn: async () => resposta(200, '<html>') });
    await expect(quebrado.getJson('https://exemplo.gov.br/g')).rejects.toThrow(/não é JSON/);
  });
});

describe('lerRetryAfter', () => {
  it('lê segundos e datas HTTP', () => {
    expect(lerRetryAfter('5')).toBe(5000);
    const agora = Date.parse('2026-10-07T12:00:00Z');
    expect(lerRetryAfter('Wed, 07 Oct 2026 12:00:03 GMT', agora)).toBe(3000);
    expect(lerRetryAfter('depois')).toBeNull();
    expect(lerRetryAfter(null)).toBeNull();
  });
});

describe('limitador', () => {
  it('nunca passa do máximo de tarefas simultâneas e devolve todos os resultados', async () => {
    const limitar = limitador(3);
    let ativas = 0;
    let maximo = 0;
    const tarefas = Array.from({ length: 10 }, (_, i) =>
      limitar(async () => {
        ativas += 1;
        maximo = Math.max(maximo, ativas);
        await new Promise((r) => setTimeout(r, 5));
        ativas -= 1;
        return i;
      }),
    );
    await expect(Promise.all(tarefas)).resolves.toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(maximo).toBe(3);
  });

  it('repassa erros sem travar a fila', async () => {
    const limitar = limitador(1);
    const falha = limitar(async () => {
      throw new Error('falhou');
    });
    const depois = limitar(async () => 'ok');
    await expect(falha).rejects.toThrow('falhou');
    await expect(depois).resolves.toBe('ok');
  });

  it('recusa concorrência inválida', () => {
    expect(() => limitador(0)).toThrow();
  });
});
