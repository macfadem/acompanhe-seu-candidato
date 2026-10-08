import { describe, expect, it } from 'vitest';
import { anotacoesGithub, detalhesAvisos, ordenarAvisos, resumoMarkdown, resumoTexto } from '../src/relatorio.js';
import { normalizarRespostaSenado, RespostaVotacoesSenado } from '../src/senado.js';
import type { Aviso, Coleta } from '../src/tipos.js';
import { validar } from '../src/validar.js';
import { fixture } from './apoio.js';

const coletaSenado = (): Coleta =>
  normalizarRespostaSenado(validar(RespostaVotacoesSenado, fixture('senado-votacao-2026-06.json'), 'fixture'));

const aviso = (tipo: Aviso['tipo'], votacaoId: string, detalhe = 'detalhe'): Aviso => ({ tipo, votacaoId, detalhe });

describe('relatório da coleta', () => {
  it('ordena os avisos pelo que exige ação primeiro', () => {
    const ordenados = ordenarAvisos([
      aviso('votos_indisponiveis', 'camara:2'),
      aviso('codigo_voto_desconhecido', 'camara:3'),
      aviso('formato_inesperado', 'camara:1'),
    ]);
    expect(ordenados.map((a) => a.tipo)).toEqual(['formato_inesperado', 'codigo_voto_desconhecido', 'votos_indisponiveis']);
  });

  it('resumo no terminal com contagem por casa e por tipo de aviso', () => {
    const coleta = coletaSenado();
    expect(resumoTexto(coleta)).toBe(
      'senado: 3 votações de plenário (3 nominais, 0 sem voto individual)\nvotos: 243 · parlamentares: 81\navisos: nenhum',
    );
    coleta.avisos.push(aviso('votos_indisponiveis', 'camara:1'), aviso('votos_indisponiveis', 'camara:2'));
    expect(resumoTexto(coleta)).toMatch(/avisos: votos_indisponiveis=2$/);
  });

  it('detalhes no terminal: indenta as linhas extras e limita a lista', () => {
    const avisos = [aviso('formato_inesperado', 'camara:1', 'Formato inesperado em votos 1:\n✖ dados[*].x: problema')];
    expect(detalhesAvisos(avisos)).toBe('- formato_inesperado · camara:1: Formato inesperado em votos 1:\n    ✖ dados[*].x: problema');
    const muitos = Array.from({ length: 20 }, (_, i) => aviso('votos_indisponiveis', `camara:${i}`));
    expect(detalhesAvisos(muitos, 15).split('\n').at(-1)).toBe('- … e mais 5 no arquivo');
  });

  it('anotações do GitHub: uma linha por aviso, com escapes, e o resto contado no fim', () => {
    const avisos = [
      aviso('formato_inesperado', 'camara:1', 'Formato inesperado:\n✖ 100% quebrado'),
      ...Array.from({ length: 12 }, (_, i) => aviso('votos_indisponiveis', `camara:${10 + i}`, 'HTTP 404 em /votos')),
    ];
    const linhas = anotacoesGithub(avisos, 'dados/x.json');
    expect(linhas).toHaveLength(10);
    expect(linhas[0]).toBe('::error title=formato_inesperado · camara%3A1::Formato inesperado:%0A✖ 100%25 quebrado');
    expect(linhas[1]).toMatch(/^::warning title=votos_indisponiveis · camara%3A10::HTTP 404 em \/votos$/);
    expect(linhas.every((l) => !l.includes('\n'))).toBe(true);
    expect(linhas.at(-1)).toMatch(/^::warning title=Coleta de votações::mais 4 aviso\(s\)/);
  });

  it('resumo da execução em Markdown, com link para a API e células seguras', () => {
    const coleta = coletaSenado();
    coleta.avisos.push(aviso('placar_divergente', 'senado:7092', 'contado | texto\n<b>oficial</b>'));
    const md = resumoMarkdown(coleta, { de: '2026-06-01', ate: '2026-06-30', arquivo: 'dados/x.json' });
    expect(md).toContain('| Senado | 3 | 3 | 0 |');
    expect(md).toContain('### Avisos (1)');
    expect(md).toContain('| placar_divergente | [senado:7092](https://legis.senado.leg.br/dadosabertos/votacao?');
    expect(md).toContain('contado \\| texto<br>&lt;b&gt;oficial&lt;/b&gt; |');
  });

  it('sem avisos, o resumo diz isso', () => {
    expect(resumoMarkdown(coletaSenado(), { de: 'a', ate: 'b', arquivo: 'c' })).toMatch(/Nenhum aviso\.\n$/);
  });
});
