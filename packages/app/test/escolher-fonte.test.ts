import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ArquivoColetaCompleto } from '@acompanhe/pipeline/arquivo-coleta';
import { CATEGORIAS_VOTO } from '@acompanhe/pipeline/tipos';
import { fonteDeDados } from '../src/fontes/escolher';
import { coletaDeExemplo } from '../src/fontes/exemplo';
import { coleta, parlamentar, votacao, voto } from './apoio';

function arquivoTemporario(nome: string, conteudo: string): string {
  const caminho = join(mkdtempSync(join(tmpdir(), 'acompanhe-app-')), nome);
  writeFileSync(caminho, conteudo);
  return caminho;
}

describe('dados de exemplo', () => {
  const exemplo = coletaDeExemplo();

  it('passam no esquema completo do pipeline, o mesmo que a gravação no banco usa', () => {
    const r = ArquivoColetaCompleto.safeParse(exemplo);
    expect(r.error?.issues ?? []).toEqual([]);
  });

  it('mostram cada categoria de voto pelo menos uma vez (menos "outro", que é código não mapeado)', () => {
    const presentes = new Set(exemplo.votos.map((v) => v.categoria));
    expect(CATEGORIAS_VOTO.filter((c) => c !== 'outro' && !presentes.has(c))).toEqual([]);
  });

  it('são sempre iguais, com 2 deputados e 1 senador por UF e nomes sem repetição', () => {
    expect(coletaDeExemplo()).toEqual(exemplo);
    expect(exemplo.parlamentares).toHaveLength(81);
    expect(new Set(exemplo.parlamentares.map((p) => p.nome)).size).toBe(81);
    expect(exemplo.parlamentares.filter((p) => p.uf === 'MG').map((p) => p.casa)).toEqual(['camara', 'camara', 'senado']);
  });

  it('o placar de cada votação aberta bate com os votos gerados', () => {
    for (const v of exemplo.votacoes) {
      if (!v.placar) continue;
      const sim = exemplo.votos.filter((x) => x.votacaoId === v.id && x.categoria === 'sim').length;
      expect(v.placar.sim, v.id).toBe(sim);
    }
  });

  it('são o padrão quando DADOS_ARQUIVO não está definido', async () => {
    const fonte = fonteDeDados({});
    expect(fonte.origem).toEqual({ tipo: 'exemplo' });
    expect((await fonte.listarParlamentares()).length).toBeGreaterThan(0);
  });
});

describe('DADOS_ARQUIVO', () => {
  it('lê o arquivo gerado pela coleta e informa o período', async () => {
    const caminho = arquivoTemporario(
      'votacoes.json',
      JSON.stringify({
        ...coleta({
          parlamentares: [parlamentar('senado:7', 'Elisa')],
          votacoes: [votacao('senado:70', '2026-06-10')],
          votos: [voto('senado:70', 'senado:7')],
        }),
        geradoEm: '2026-07-01T12:00:00.000Z',
        intervalo: { de: '2026-06-01', ate: '2026-06-30' },
        avisos: [],
      }),
    );
    const fonte = fonteDeDados({ DADOS_ARQUIVO: caminho });
    expect(fonte.origem).toEqual({
      tipo: 'arquivo',
      caminho,
      geradoEm: '2026-07-01T12:00:00.000Z',
      intervalo: { de: '2026-06-01', ate: '2026-06-30' },
    });
    expect((await fonte.votosDoParlamentar('senado:7')).total).toBe(1);
  });

  it('arquivo que não existe: o erro diz a variável, o caminho e o motivo', () => {
    const caminho = join(tmpdir(), 'acompanhe-nao-existe.json');
    expect(() => fonteDeDados({ DADOS_ARQUIVO: caminho })).toThrow(
      `DADOS_ARQUIVO: não foi possível ler ${caminho} (ENOENT)`,
    );
  });

  it('arquivo que não é JSON: o erro diz qual é', () => {
    const caminho = arquivoTemporario('quebrado.json', '{ "parlamentares": [');
    expect(() => fonteDeDados({ DADOS_ARQUIVO: caminho })).toThrow(`DADOS_ARQUIVO: ${caminho} não é um JSON válido`);
  });
});
