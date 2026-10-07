import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { anotacao, escreverResumoExecucao, noGithubActions, urlExecucao } from '../src/github.js';
import {
  type Alvo,
  anotacoesSpike,
  cobertura,
  executarSpike,
  instrucoesDownload,
  paraResumo,
  type ResultadoAlvo,
} from '../src/spike/executar.js';

describe('comandos do GitHub Actions', () => {
  it('escapa quebras de linha, % e, no título, ":" e ","', () => {
    expect(anotacao('notice', 'a\nb 100%', 'Título: x, y')).toBe('::notice title=Título%3A x%2C y::a%0Ab 100%25');
    expect(anotacao('warning', 'sem título')).toBe('::warning::sem título');
    // Uma mensagem maliciosa não consegue abrir outro comando numa linha nova.
    expect(anotacao('notice', 'x\n::error::falso')).not.toContain('\n');
  });

  it('resumo da execução só é escrito no Actions', async () => {
    const pasta = await mkdtemp(path.join(tmpdir(), 'resumo-'));
    const arquivo = path.join(pasta, 'resumo.md');
    expect(await escreverResumoExecucao('# A', {})).toBe(false);
    expect(await escreverResumoExecucao('# A', { GITHUB_STEP_SUMMARY: arquivo })).toBe(true);
    expect(await escreverResumoExecucao('linha\n', { GITHUB_STEP_SUMMARY: arquivo })).toBe(true);
    expect(await readFile(arquivo, 'utf8')).toBe('# A\nlinha\n');
  });

  it('detecta o Actions e monta o link da execução', () => {
    expect(noGithubActions({ GITHUB_ACTIONS: 'true' })).toBe(true);
    expect(noGithubActions({})).toBe(false);
    expect(urlExecucao({})).toBeNull();
    expect(
      urlExecucao({ GITHUB_SERVER_URL: 'https://github.com', GITHUB_REPOSITORY: 'o/r', GITHUB_RUN_ID: '42' }),
    ).toBe('https://github.com/o/r/actions/runs/42');
  });
});

describe('spike no Actions: cobertura e anotações', () => {
  const alvo = (tipo: Alvo['tipo'], rotulo: string): Alvo => ({
    tipo,
    rotulo,
    casa: 'camara',
    uf: null,
    partido: null,
    consulta: 'x',
    janela: { periodo: '3m' },
  });
  const materia = (veiculo: string, n: number) => ({
    titulo: `t${n}`,
    veiculo,
    data: '2026-09-02',
    url: `https://${veiculo}/${n}`,
  });
  const resultados: ResultadoAlvo[] = [
    { alvo: alvo('parlamentar', 'Fulana (A-MG)'), materias: [materia('a.com.br', 1), materia('b.com.br', 2), materia('a.com.br', 3)], erro: null },
    { alvo: alvo('parlamentar', 'Beltrano (B-SP)'), materias: [], erro: null },
    { alvo: alvo('votacao', 'PL 1/2026 — Câmara, 2026-09-02'), materias: [materia('b.com.br', 4)], erro: null },
    { alvo: alvo('votacao', 'PEC 2/2026 — Senado, 2026-09-03'), materias: [], erro: 'HTTP 429' },
  ];

  it('conta alvos com matéria, erros e veículos', () => {
    expect(cobertura(resultados)).toEqual({
      parlamentares: { com: 1, total: 2 },
      votacoes: { com: 1, total: 2 },
      erros: 1,
      veiculos: [
        ['a.com.br', 2],
        ['b.com.br', 2],
      ],
    });
  });

  it('agrupa a cobertura em poucas anotações (o GitHub mostra até 10 por nível)', () => {
    const comandos = anotacoesSpike(resultados);
    expect(comandos).toHaveLength(4);
    expect(comandos.filter((c) => c.startsWith('::notice'))).toHaveLength(3);
    expect(comandos[0]).toContain('Parlamentares com matéria: 1 de 2 (50%25)'); // % escapado; o GitHub mostra 50%
    expect(comandos[1]).toMatch(/^::notice title=Cobertura por parlamentar \(2\)::/);
    expect(comandos[1]).toContain('3 matéria(s), 2 veículo(s) — Fulana (A-MG)%0A0 matéria(s), 0 veículo(s) — Beltrano (B-SP)');
    expect(comandos[2]).toContain('[erro: HTTP 429]');
    expect(comandos[3]).toMatch(/^::warning title=Consultas à GDELT com erro \(1\)::PEC 2\/2026/);
    for (const c of comandos) expect(c).not.toContain('\n');
  });

  it('resumo e instruções de download', () => {
    const resumo = paraResumo(resultados, { arquivo: 'x.json', semente: 1, geradoEm: '2026-10-07' });
    expect(resumo).toContain('Votações com pelo menos 1 matéria citando o número: 1 de 2 (50%)');
    expect(resumo).toContain('Veículos distintos: 2 — mais frequentes: a.com.br (2), b.com.br (2)');
    const instrucoes = instrucoesDownload('https://github.com/o/r/actions/runs/42', 'spike-noticias');
    expect(instrucoes).toContain('[página desta execução](https://github.com/o/r/actions/runs/42)');
    expect(instrucoes).toContain('gh run download 42 -n spike-noticias');
    expect(instrucoesDownload(null, 'spike-noticias')).toContain('<id-da-execução>');
  });

  it('com prazo, para de consultar e registra os alvos que sobraram', async () => {
    let relogio = 0;
    const cliente = {
      async getJson() {
        relogio += 60_000; // cada consulta "leva" 1 minuto
        return { articles: [] };
      },
    };
    const alvos = [alvo('parlamentar', 'A'), alvo('parlamentar', 'B'), alvo('votacao', 'C')];
    const r = await executarSpike(alvos, cliente, { intervaloMs: 0, esperar: async () => {}, prazoMs: 90_000, agora: () => relogio });
    expect(r.map((x) => x.erro)).toEqual([null, null, 'não consultado: prazo esgotado']);
  });
});
