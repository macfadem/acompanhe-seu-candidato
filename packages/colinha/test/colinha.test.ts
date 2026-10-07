import { describe, expect, it } from 'vitest';
import {
  type ArmazenamentoSimples,
  apagar,
  armazenamentoDoNavegador,
  CHAVE,
  carregar,
  codificar,
  type Colinha,
  decodificar,
  definirUf,
  deArquivo,
  escolher,
  lerDoFragmento,
  linkDeExportacao,
  mesmaColinha,
  novaColinha,
  paraArquivo,
  remover,
  salvar,
  urlSemFragmento,
} from '../src/index.js';

// Códigos de candidato fictícios (formato do SQ_CANDIDATO do TSE).
const DEP_A = '250002000001';
const DEP_B = '250002000002';
const SEN_A = '250002000011';
const SEN_B = '250002000012';
const SEN_C = '250002000013';

function montar(...passos: Array<[('deputado_federal' | 'senador'), string]>): Colinha {
  let colinha = novaColinha('MG');
  for (const [cargo, sq] of passos) {
    const r = escolher(colinha, { cargo, sq });
    if (!r.ok) throw new Error(r.erro);
    colinha = r.valor;
  }
  return colinha;
}

class ArmazenamentoFalso implements ArmazenamentoSimples {
  dados = new Map<string, string>();
  getItem(k: string) {
    return this.dados.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.dados.set(k, v);
  }
  removeItem(k: string) {
    this.dados.delete(k);
  }
}

describe('montar a colinha', () => {
  it('um deputado federal (o novo substitui o anterior) e até dois senadores', () => {
    const colinha = montar(['deputado_federal', DEP_A], ['senador', SEN_A], ['senador', SEN_B], ['deputado_federal', DEP_B]);
    expect(colinha.itens).toEqual([
      { cargo: 'senador', sq: SEN_A },
      { cargo: 'senador', sq: SEN_B },
      { cargo: 'deputado_federal', sq: DEP_B },
    ]);
  });

  it('terceiro senador é recusado com mensagem clara', () => {
    const r = escolher(montar(['senador', SEN_A], ['senador', SEN_B]), { cargo: 'senador', sq: SEN_C });
    expect(r).toEqual({ ok: false, erro: expect.stringMatching(/remova um/) });
  });

  it('nunca altera o objeto original', () => {
    const original = montar(['senador', SEN_A]);
    const copia = structuredClone(original);
    escolher(original, { cargo: 'deputado_federal', sq: DEP_A });
    remover(original, SEN_A);
    expect(original).toEqual(copia);
  });

  it('recusa código e UF inválidos', () => {
    expect(escolher(novaColinha(), { cargo: 'senador', sq: '12a' }).ok).toBe(false);
    expect(definirUf(novaColinha(), 'Minas').ok).toBe(false);
    expect(definirUf(novaColinha(), 'MG').ok).toBe(true);
  });
});

describe('link e QR code (fragmento #c=)', () => {
  const colinha = montar(['deputado_federal', DEP_A], ['senador', SEN_A], ['senador', SEN_B]);

  it('ida e volta sem perder nada, com texto curto e seguro para URL', () => {
    const token = codificar(colinha);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeLessThan(300);
    const volta = decodificar(token);
    expect(volta.ok && mesmaColinha(volta.valor, colinha)).toBe(true);
  });

  it('privacidade: o link nunca leva dados na query string (que vai ao servidor)', () => {
    const link = linkDeExportacao('https://app.exemplo.org/colinha?utm_source=x#antigo', colinha);
    const url = new URL(link);
    expect(url.search).toBe('');
    expect(url.hash.startsWith('#c=')).toBe(true);
    expect(link).not.toContain(SEN_A); // nem o código aparece em texto puro
  });

  it('lê o fragmento: colinha válida, outro fragmento qualquer e link quebrado', () => {
    const link = linkDeExportacao('https://app.exemplo.org/', colinha);
    const lida = lerDoFragmento(new URL(link).hash);
    expect(lida?.ok).toBe(true);
    expect(lerDoFragmento('#secao-votacoes')).toBeNull();
    expect(lerDoFragmento('')).toBeNull();
    expect(lerDoFragmento('#c=%%%')).toEqual({ ok: false, erro: expect.any(String) });
  });

  it('recusa colinhas adulteradas (versão errada, senadores demais, repetidos, texto gigante)', () => {
    const adulterar = (dado: unknown) =>
      btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(dado))))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    expect(decodificar(adulterar({ ...colinha, v: 2 })).ok).toBe(false);
    expect(
      decodificar(
        adulterar({ ...colinha, itens: [...colinha.itens, { cargo: 'senador', sq: SEN_C }] }),
      ).ok,
    ).toBe(false);
    expect(
      decodificar(adulterar({ ...colinha, itens: [{ cargo: 'senador', sq: SEN_A }, { cargo: 'senador', sq: SEN_A }] }))
        .ok,
    ).toBe(false);
    expect(decodificar('A'.repeat(5000)).ok).toBe(false);
  });

  it('remove o fragmento da barra de endereço depois de importar', () => {
    expect(urlSemFragmento('https://app.exemplo.org/minha?x=1#c=abc')).toBe('https://app.exemplo.org/minha?x=1');
  });
});

describe('armazenamento no aparelho', () => {
  it('salva e carrega', () => {
    const armazenamento = new ArmazenamentoFalso();
    const colinha = montar(['senador', SEN_A]);
    expect(salvar(armazenamento, colinha)).toBe(true);
    expect(carregar(armazenamento)).toEqual({ estado: 'ok', colinha });
    expect(apagar(armazenamento)).toBe(true);
    expect(carregar(armazenamento)).toEqual({ estado: 'vazio' });
  });

  it('sem armazenamento (aba anônima, bloqueio) o app segue sem quebrar', () => {
    expect(carregar(null)).toEqual({ estado: 'indisponivel' });
    expect(salvar(null, novaColinha())).toBe(false);
    const cheio = new ArmazenamentoFalso();
    cheio.setItem = () => {
      throw new DOMException('cota excedida', 'QuotaExceededError');
    };
    expect(salvar(cheio, novaColinha())).toBe(false);
    expect(() => armazenamentoDoNavegador()).not.toThrow();
  });

  it('dado salvo quebrado não derruba o app', () => {
    const armazenamento = new ArmazenamentoFalso();
    armazenamento.setItem(CHAVE, '{"v":1,');
    expect(carregar(armazenamento)).toEqual({ estado: 'invalido' });
    armazenamento.setItem(CHAVE, JSON.stringify({ v: 9 }));
    expect(carregar(armazenamento)).toEqual({ estado: 'invalido' });
  });
});

describe('arquivo', () => {
  const colinha = montar(['deputado_federal', DEP_A]);

  it('exporta e importa o arquivo do app', () => {
    const r = deArquivo(paraArquivo(colinha, new Date('2026-10-07T12:00:00Z')));
    expect(r.ok && mesmaColinha(r.valor, colinha)).toBe(true);
  });

  it('também aceita o link de exportação colado como texto', () => {
    const r = deArquivo(linkDeExportacao('https://app.exemplo.org/', colinha));
    expect(r.ok).toBe(true);
  });

  it('recusa arquivos que não são colinha', () => {
    expect(deArquivo('{"formato":"outra-coisa"}').ok).toBe(false);
    expect(deArquivo('não é json').ok).toBe(false);
  });
});
