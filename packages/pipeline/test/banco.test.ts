import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { type LinhasBanco, paraLinhasBanco } from '../src/linhas.js';
import { normalizarRespostaSenado, RespostaVotacoesSenado } from '../src/senado.js';
import { validar } from '../src/validar.js';
import { fixture } from './apoio.js';
import { bancoEmMemoria, contar } from './banco-apoio.js';

async function inserir(db: PGlite, tabela: string, linhas: ReadonlyArray<Record<string, unknown>>): Promise<void> {
  for (const linha of linhas) {
    const colunas = Object.keys(linha);
    const marcadores = colunas.map((_, i) => `$${i + 1}`).join(', ');
    await db.query(`insert into public.${tabela} (${colunas.join(', ')}) values (${marcadores})`, Object.values(linha));
  }
}

async function gravar(db: PGlite, linhas: LinhasBanco): Promise<void> {
  await inserir(db, 'parlamentar', linhas.parlamentar);
  await inserir(db, 'votacao', linhas.votacao);
  await inserir(db, 'voto', linhas.voto);
}

describe('esquema do banco (supabase/migrations)', () => {
  let db: PGlite;
  const coleta = normalizarRespostaSenado(
    validar(RespostaVotacoesSenado, fixture('senado-votacao-2026-06.json'), 'fixture do Senado'),
  );

  beforeAll(async () => {
    db = await bancoEmMemoria();
    await gravar(db, paraLinhasBanco(coleta));
  }, 60_000);

  it('aceita a coleta real do Senado', async () => {
    expect(await contar(db, 'parlamentar')).toBe(81);
    expect(await contar(db, 'votacao')).toBe(3);
    expect(await contar(db, 'voto')).toBe(243);
  });

  it('responde a consulta típica do app: como votou um senador', async () => {
    const { rows } = await db.query<{ proposicao: string; categoria: string }>(`
      select v.proposicao_sigla || ' ' || v.proposicao_numero || '/' || v.proposicao_ano as proposicao, vt.categoria
      from public.voto vt join public.votacao v on v.id = vt.votacao_id
      where vt.parlamentar_id = 'senado:5672'
      order by v.data`);
    expect(rows).toEqual([
      { proposicao: 'PLP 55/2026', categoria: 'sim' },
      { proposicao: 'OFS 4/2026', categoria: 'secreto' },
      { proposicao: 'PLP 73/2025', categoria: 'sim' },
    ]);
  });

  it('visitante anônimo lê, mas não consegue escrever', async () => {
    await db.exec('set role anon');
    try {
      expect(await contar(db, 'voto')).toBe(243);
      await expect(
        db.query(`insert into public.parlamentar (id, casa, id_casa, nome, referencia_data)
                  values ('senado:1', 'senado', '1', 'Teste', '2026-06-01')`),
      ).rejects.toThrow(/permission denied/);
      await expect(db.query(`update public.votacao set resultado = 'rejeitada'`)).rejects.toThrow(/permission denied/);
      await expect(db.query('delete from public.voto')).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec('reset role');
    }
    expect(await contar(db, 'voto')).toBe(243);
  });

  it('recusa dados incoerentes', async () => {
    const valida = paraLinhasBanco(coleta).votacao[0]!;
    await expect(inserir(db, 'votacao', [{ ...valida, id: 'senado:1', id_casa: '2' }])).rejects.toThrow(/check/);
    await expect(
      inserir(db, 'votacao', [{ ...valida, id: 'senado:2', id_casa: '2', placar_sim: null }]),
    ).rejects.toThrow(/check/);
    await expect(
      db.query(`update public.voto set categoria = 'talvez' where parlamentar_id = 'senado:5672'`),
    ).rejects.toThrow(/check/);
    await expect(db.query(`update public.parlamentar set uf = 'Acre' where id = 'senado:5672'`)).rejects.toThrow(
      /check/,
    );
  });
});
