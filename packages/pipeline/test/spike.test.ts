import { describe, expect, it, vi } from 'vitest';
import { normalizarRespostaSenado, RespostaVotacoesSenado } from '../src/senado.js';
import { amostrarParlamentares, amostrarVotacoes, embaralhar, geradorAleatorio } from '../src/spike/amostra.js';
import { executarSpike, montarAlvos, paraCsv, paraResumo, type Alvo } from '../src/spike/executar.js';
import {
  consultaParlamentar,
  consultaProposicao,
  dataDoSeendate,
  urlConsultaGdelt,
  variantesNumero,
} from '../src/spike/gdelt.js';
import type { Parlamentar } from '../src/tipos.js';
import { validar } from '../src/validar.js';
import { clienteFalso, fixture } from './apoio.js';

const coleta = normalizarRespostaSenado(validar(RespostaVotacoesSenado, fixture('senado-votacao-2026-06.json'), 'fixture'));

describe('amostra reprodutível', () => {
  it('mesma semente, mesma sequência; semente diferente, outra sequência', () => {
    const a = geradorAleatorio(42);
    const b = geradorAleatorio(42);
    const c = geradorAleatorio(43);
    const sa = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(sa);
    expect([c(), c(), c()]).not.toEqual(sa);
    expect(embaralhar([1, 2, 3, 4, 5], geradorAleatorio(7)).sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('respeita os limites por UF e por partido e não depende da ordem de entrada', () => {
    const criterios = { tamanho: 10, maxPorUf: 1, maxPorPartido: 2 };
    const amostra = amostrarParlamentares(coleta.parlamentares, criterios, 20261007);
    const deTrasPraFrente = amostrarParlamentares([...coleta.parlamentares].reverse(), criterios, 20261007);
    expect(amostra.map((p) => p.id)).toEqual(deTrasPraFrente.map((p) => p.id));
    expect(amostra).toHaveLength(10);
    const contar = (campo: keyof Parlamentar) =>
      Math.max(...[...new Set(amostra.map((p) => p[campo]))].map((v) => amostra.filter((p) => p[campo] === v).length));
    expect(contar('uf')).toBe(1);
    expect(contar('partido')).toBeLessThanOrEqual(2);
  });

  it('votações: uma por proposição, só nominais de plenário a partir da data pedida', () => {
    expect(amostrarVotacoes(coleta.votacoes, 10, 1, '2026-06-10').map((v) => v.id).sort()).toEqual([
      'senado:7093',
      'senado:7095',
    ]);
  });
});

describe('consultas à GDELT', () => {
  it('formas do número da proposição', () => {
    expect(variantesNumero({ sigla: 'PL', numero: '4133', ano: 2023 })).toEqual([
      'PL 4133/2023',
      'PL 4.133/2023',
      '4133/2023',
      '4.133/2023',
      '4,133/2023',
    ]);
    expect(variantesNumero({ sigla: 'MPV', numero: '1343', ano: 2026 })).toContain('MP 1.343/2026');
  });

  it('monta consultas e URL no formato da API', () => {
    expect(consultaParlamentar({ nome: 'Dra. Eudócia', casa: 'senado' })).toBe(
      '"Dra. Eudócia" senator sourcecountry:brazil', // a GDELT busca na tradução para o inglês
    );
    expect(consultaProposicao({ sigla: 'PLP', numero: '55', ano: 2026 })).toBe(
      '("PLP 55/2026" OR "55/2026") sourcecountry:brazil',
    );
    const url = new URL(
      urlConsultaGdelt('"x"', { inicio: new Date('2026-09-01T00:00:00Z'), fim: new Date('2026-09-04T00:00:00Z') }),
    );
    expect(url.origin + url.pathname).toBe('https://api.gdeltproject.org/api/v2/doc/doc');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      mode: 'artlist',
      format: 'json',
      startdatetime: '20260901000000',
      enddatetime: '20260904000000',
    });
    expect(dataDoSeendate('20260902T214500Z')).toBe('2026-09-02T21:45:00Z');
  });
});

describe('execução do spike (cliente falso, resposta sintética no formato da GDELT)', () => {
  const alvos: Alvo[] = [
    {
      tipo: 'parlamentar',
      rotulo: 'Fulano (X-MG)',
      casa: 'camara',
      uf: 'MG',
      partido: 'X',
      consulta: '"Fulano" (deputado OR deputada) sourcecountry:brazil',
      janela: { periodo: '3m' },
    },
    {
      tipo: 'votacao',
      rotulo: 'PL 1/2026 — Câmara, 2026-09-02',
      casa: 'camara',
      uf: null,
      partido: null,
      consulta: '("PL 1/2026") sourcecountry:brazil',
      janela: { periodo: '3m' },
    },
  ];

  it('consulta um alvo por vez, com pausa, e segue mesmo se uma consulta falhar', async () => {
    const [primeiro, segundo] = alvos as [Alvo, Alvo];
    const cliente = clienteFalso({
      [urlConsultaGdelt(primeiro.consulta, primeiro.janela)]: {
        articles: [
          { url: 'https://exemplo.com.br/a', title: 'Deputado "Fulano"; fala', seendate: '20260902T214500Z', domain: 'exemplo.com.br' },
          { url: 'https://exemplo.com.br/a', title: 'repetida', seendate: '20260902T214500Z', domain: 'exemplo.com.br' },
        ],
      },
      [urlConsultaGdelt(segundo.consulta, segundo.janela)]: new Error('Resposta não é JSON'),
    });
    const esperar = vi.fn(async () => {});
    const resultados = await executarSpike(alvos, cliente, { intervaloMs: 6000, esperar });

    expect(esperar.mock.calls).toEqual([[6000]]);
    expect(resultados[0]?.materias).toHaveLength(1); // link repetido conta uma vez
    expect(resultados[1]).toMatchObject({ materias: [], erro: 'Resposta não é JSON' });

    const csv = paraCsv(resultados);
    expect(csv.startsWith('﻿tipo;alvo;')).toBe(true);
    expect(csv).toContain('"Deputado ""Fulano""; fala"'); // aspas e ";" escapados
    const resumo = paraResumo(resultados, { arquivo: 'x.json', semente: 1, geradoEm: '2026-10-07' });
    expect(resumo).toContain('Parlamentares com pelo menos 1 matéria: 1 de 1 (100%)');
    expect(resumo).toContain('Consultas com erro: 1');
  });

  it('monta alvos a partir do arquivo da coleta (votações antigas ficam de fora da janela da GDELT)', () => {
    const alvosDaColeta = montarAlvos(coleta, {
      semente: 20261007,
      deputados: 5,
      senadores: 4,
      votacoes: 5,
      intervaloMs: 6000,
      hoje: '2026-10-07',
    });
    expect(alvosDaColeta.filter((a) => a.tipo === 'parlamentar')).toHaveLength(4); // a fixture só tem senadores
    expect(alvosDaColeta.filter((a) => a.tipo === 'votacao')).toHaveLength(0); // junho está fora dos 85 dias
  });
});
