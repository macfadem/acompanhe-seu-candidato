import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { contarEleitos, lerCandidatos, resumoCandidatos } from '../src/tse/candidatos.js';
import { decodificarLatin1, linhasCsv } from '../src/tse/csv.js';
import { gravarCandidatos } from '../src/tse/gravar-candidatos.js';
import { ErroFormato } from '../src/validar.js';
import { bancoEmMemoria, contar } from './banco-apoio.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
/** Fixture sintética (Latin-1) com o cabeçalho real do TSE de 07/10/2026; pessoas e partidos fictícios. */
const bytes = readFileSync(path.join(AQUI, 'fixtures', 'tse-consulta-cand-2026-sintetico.csv'));
const texto = decodificarLatin1(bytes);

function serializar(linhas: string[][]): string {
  return linhas.map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(';')).join('\r\n');
}

describe('CSV do TSE', () => {
  it('aspas, aspas duplicadas, ";" dentro de aspas, \\r\\n e \\n', () => {
    const csv = '"a";"b ""c"";d";3\r\n"x;y";;"z"\n"última"';
    expect([...linhasCsv(csv)]).toEqual([
      ['a', 'b "c";d', '3'],
      ['x;y', '', 'z'],
      ['última'],
    ]);
    expect(() => [...linhasCsv('"aberta;sem fim\n')]).toThrow(/aspas não fechadas/);
  });

  it('decodifica Latin-1 (acentos de 1 byte)', () => {
    expect(bytes.toString('utf8')).toContain('\uFFFD'); // como UTF-8, os acentos quebram
    expect(texto).toContain('ANA DA SAÚDE');
  });
});

describe('candidatos do TSE (guiado pelo cabeçalho)', () => {
  it('lê só deputados federais e senadores, com a situação da totalização', () => {
    const leitura = lerCandidatos(texto);
    expect(leitura).toMatchObject({ linhas: 10, foraDoEscopo: 3, avisos: [] });
    expect(leitura.candidatos.map((c) => [c.cargo, c.uf, c.situacaoTotalizacao])).toEqual([
      ['deputado_federal', 'MG', 'ELEITO POR QP'],
      ['deputado_federal', 'MG', 'ELEITO POR MÉDIA'],
      ['deputado_federal', 'MG', 'SUPLENTE'],
      ['deputado_federal', 'SP', 'NÃO ELEITO'],
      ['deputado_federal', 'SP', null], // #NULO: sem totalização
      ['senador', 'MG', 'ELEITO'],
      ['senador', 'SP', 'NÃO ELEITO'],
    ]);
    expect(leitura.candidatos[1]).toEqual({
      sqCandidato: '130000000002',
      ano: 2026,
      cargo: 'deputado_federal',
      uf: 'MG',
      numero: 2222,
      nomeUrna: 'BRUNO "DO POVO"',
      nomeCivil: 'BRUNO EXEMPLO; JÚNIOR',
      partido: 'PXB',
      federacao: 'FED X',
      cdSituacaoTotalizacao: 3,
      situacaoTotalizacao: 'ELEITO POR MÉDIA',
      geradoEmTse: '2026-10-07T09:59:27',
    });
    expect(leitura.candidatos[0]?.federacao).toBeNull();
    expect(contarEleitos(leitura.candidatos)).toEqual({ deputado_federal: 2, senador: 1 });
  });

  it('não carrega dados pessoais do arquivo (CPF, título, e-mail, nascimento)', () => {
    const json = JSON.stringify(lerCandidatos(texto));
    for (const proibido of ['00000000000', '000000000000', 'NÃO DIVULGÁVEL', '01/01/1980', 'Cpf', 'cpf']) {
      expect(json).not.toContain(proibido);
    }
  });

  it('nome social, quando informado, substitui o nome de registro (que não é guardado)', () => {
    const linhas = [...linhasCsv(texto)];
    const cab = linhas[0]!;
    const comSocial = [...linhas[1]!];
    comSocial[cab.indexOf('NM_SOCIAL_CANDIDATO')] = 'ANA SOCIAL DE SOUZA';
    const leitura = lerCandidatos(serializar([cab, comSocial, linhas[2]!]));
    expect(leitura.candidatos.map((c) => c.nomeCivil)).toEqual(['ANA SOCIAL DE SOUZA', 'BRUNO EXEMPLO; JÚNIOR']);
    expect(JSON.stringify(leitura)).not.toContain('ANA FICTÍCIA DE SOUZA');
  });

  it('a ordem das colunas não importa; coluna obrigatória ausente é erro', () => {
    const linhas = [...linhasCsv(texto)];
    const ordem = linhas[0]!.map((_, i) => i).reverse();
    const invertido = serializar(linhas.map((l) => ordem.map((i) => l[i]!)));
    expect(lerCandidatos(invertido).candidatos).toEqual(lerCandidatos(texto).candidatos);

    const semSituacao = linhas.map((l) => l.filter((_, i) => linhas[0]![i] !== 'DS_SIT_TOT_TURNO'));
    expect(() => lerCandidatos(serializar(semSituacao))).toThrow(ErroFormato);
    expect(() => lerCandidatos(serializar(semSituacao))).toThrow(/DS_SIT_TOT_TURNO/);
  });

  it('avisa sobre código de situação novo, divergente, SQ repetido e linha quebrada', () => {
    const linhas = [...linhasCsv(texto)];
    const cab = linhas[0]!;
    const col = (nome: string) => cab.indexOf(nome);
    const copia = (i: number, mudar: Record<string, string>) => {
      const l = [...linhas[i]!];
      for (const [k, v] of Object.entries(mudar)) l[col(k)] = v;
      return l;
    };
    const csv = serializar([
      cab,
      copia(1, { CD_SIT_TOT_TURNO: '9', DS_SIT_TOT_TURNO: 'NOVA SITUAÇÃO' }),
      copia(2, { DS_SIT_TOT_TURNO: 'ELEITA POR MÉDIA' }),
      copia(3, {}),
      copia(3, { NM_URNA_CANDIDATO: 'OUTRO NOME' }),
      linhas[4]!.slice(0, 10),
    ]);
    const { candidatos, avisos } = lerCandidatos(csv);
    expect(avisos.map((a) => a.tipo).sort()).toEqual([
      'candidato_repetido',
      'linha_invalida',
      'situacao_desconhecida',
      'situacao_divergente',
    ]);
    expect(candidatos).toHaveLength(3);
    expect(candidatos[0]?.situacaoTotalizacao).toBe('NOVA SITUAÇÃO'); // guarda o texto oficial
  });

  it('resumo para a página da execução: só contagens, com a fonte', () => {
    const md = resumoCandidatos(lerCandidatos(texto));
    expect(md).toContain('| ELEITO POR QP | 1 |');
    expect(md).toContain('| sem totalização (#NULO) | 1 |');
    expect(md).toContain('| MG | 2 / 3 | 1 / 1 |');
    expect(md).toContain('| SP | 0 / 2 | 0 / 1 |');
    expect(md).toContain('Fonte: TSE');
    expect(md).not.toContain('ANA FICTÍCIA'); // nenhum nome no resumo
  });
});

describe('gravação dos candidatos (Postgres em memória com as migrações)', () => {
  let db: Awaited<ReturnType<typeof bancoEmMemoria>>;
  beforeAll(async () => {
    db = await bancoEmMemoria();
  }, 60_000);

  it('grava, repete sem duplicar e não volta para um arquivo mais antigo', async () => {
    const { candidatos } = lerCandidatos(texto);
    expect(await gravarCandidatos(db, candidatos, { tamanhoLote: 3 })).toEqual({ novos: 7, atualizados: 0, mantidos: 0 });
    expect(await gravarCandidatos(db, candidatos)).toEqual({ novos: 0, atualizados: 7, mantidos: 0 });
    const antigos = candidatos.map((c) => ({ ...c, situacaoTotalizacao: null, cdSituacaoTotalizacao: null, geradoEmTse: '2026-10-06T08:00:00' }));
    expect(await gravarCandidatos(db, antigos)).toEqual({ novos: 0, atualizados: 0, mantidos: 7 });
    expect(await contar(db, 'candidato_tse', "situacao_totalizacao = 'ELEITO POR QP'")).toBe(1);
    expect(await contar(db, 'candidato_tse', 'situacao_totalizacao is null')).toBe(1);
  });

  it('visitante anônimo lê, mas não escreve', async () => {
    await db.exec('set role anon');
    try {
      expect(await contar(db, 'candidato_tse')).toBe(7);
      await expect(db.exec("delete from public.candidato_tse where uf = 'MG'")).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec('reset role');
    }
  });
});
