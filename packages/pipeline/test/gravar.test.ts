import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { gravarColeta } from '../src/gravar.js';
import { normalizarRespostaSenado, RespostaVotacoesSenado } from '../src/senado.js';
import type { Coleta } from '../src/tipos.js';
import { validar } from '../src/validar.js';
import { fixture } from './apoio.js';
import { bancoEmMemoria, contar } from './banco-apoio.js';

const coletaSenado = (): Coleta =>
  normalizarRespostaSenado(validar(RespostaVotacoesSenado, fixture('senado-votacao-2026-06.json'), 'fixture'));

describe('gravarColeta (Postgres em memória com as migrações)', () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await bancoEmMemoria();
  }, 60_000);
  beforeEach(async () => {
    await db.exec('truncate public.voto, public.votacao, public.parlamentar');
  });

  it('grava tudo numa transação e informa o que entrou', async () => {
    const resultado = await gravarColeta(db, coletaSenado(), { tamanhoLote: 50 });
    expect(resultado).toEqual({
      parlamentares: 81,
      votacoesNovas: 3,
      votacoesAtualizadas: 0,
      votacoesMantidas: 0,
      votos: 243,
    });
    expect(await contar(db, 'voto')).toBe(243);
  });

  it('pode rodar de novo sem duplicar nada', async () => {
    await gravarColeta(db, coletaSenado());
    const segunda = await gravarColeta(db, coletaSenado());
    expect(segunda).toMatchObject({ votacoesNovas: 0, votacoesAtualizadas: 3 });
    expect(await contar(db, 'parlamentar')).toBe(81);
    expect(await contar(db, 'votacao')).toBe(3);
    expect(await contar(db, 'voto')).toBe(243);
  });

  it('se algo falha no meio, nada é gravado (rollback)', async () => {
    const quebrada = coletaSenado();
    quebrada.parlamentares = quebrada.parlamentares.filter((p) => p.id !== 'senado:5672'); // voto sem parlamentar
    await expect(gravarColeta(db, quebrada)).rejects.toThrow(/foreign key|violates/);
    expect(await contar(db, 'parlamentar')).toBe(0);
    expect(await contar(db, 'votacao')).toBe(0);
  });

  it('substitui os votos de uma votação quando a fonte corrige', async () => {
    await gravarColeta(db, coletaSenado());
    const corrigida = coletaSenado();
    corrigida.votos = corrigida.votos.filter(
      (v) => !(v.votacaoId === 'senado:7092' && v.parlamentarId === 'senado:5672'),
    );
    const voto = corrigida.votos.find((v) => v.votacaoId === 'senado:7092' && v.parlamentarId === 'senado:5982')!;
    voto.categoria = 'nao';
    voto.valorOriginal = 'Não';
    await gravarColeta(db, corrigida);
    expect(await contar(db, 'voto', `votacao_id = 'senado:7092'`)).toBe(80);
    const { rows } = await db.query<{ categoria: string }>(
      `select categoria from public.voto where votacao_id = 'senado:7092' and parlamentar_id = 'senado:5982'`,
    );
    expect(rows[0]?.categoria).toBe('nao');
  });

  it('não apaga votos se uma coleta posterior vier sem eles (ex.: 404 passageiro)', async () => {
    await gravarColeta(db, coletaSenado());
    const semVotos = coletaSenado();
    const v = semVotos.votacoes.find((x) => x.id === 'senado:7092')!;
    v.nominal = false;
    v.placar = null;
    semVotos.votos = semVotos.votos.filter((x) => x.votacaoId !== 'senado:7092');
    const resultado = await gravarColeta(db, semVotos);
    expect(resultado.votacoesMantidas).toBe(1);
    expect(await contar(db, 'voto', `votacao_id = 'senado:7092'`)).toBe(81);
    expect(await contar(db, 'votacao', `id = 'senado:7092' and nominal`)).toBe(1);
  });

  it('partido/UF só mudam com informação mais recente', async () => {
    await gravarColeta(db, coletaSenado()); // referência: 16/06/2026
    const antiga = coletaSenado();
    const alan = antiga.parlamentares.find((p) => p.id === 'senado:5672')!;
    alan.partido = 'PARTIDO_ANTIGO';
    alan.referenciaData = '2026-06-01';
    await gravarColeta(db, antiga);
    expect(await contar(db, 'parlamentar', `id = 'senado:5672' and partido = 'REPUBLICANOS'`)).toBe(1);

    const nova = coletaSenado();
    const alanNovo = nova.parlamentares.find((p) => p.id === 'senado:5672')!;
    alanNovo.partido = 'PARTIDO_NOVO';
    alanNovo.referenciaData = '2026-07-01';
    await gravarColeta(db, nova);
    expect(await contar(db, 'parlamentar', `id = 'senado:5672' and partido = 'PARTIDO_NOVO'`)).toBe(1);
  });
});
