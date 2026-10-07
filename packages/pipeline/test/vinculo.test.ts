import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ClienteHttpTexto } from '../src/http.js';
import { lerCandidatos } from '../src/tse/candidatos.js';
import { decodificarLatin1 } from '../src/tse/csv.js';
import { gravarCandidatos } from '../src/tse/gravar-candidatos.js';
import { validar } from '../src/validar.js';
import { ArquivoManuais, casar, normalizarNome } from '../src/vinculo/casar.js';
import { gravarVinculos } from '../src/vinculo/gravar-vinculos.js';
import {
  CAMARA_API,
  CAMARA_CSV_DEPUTADOS,
  listaCamara,
  listaSenado,
  nomesCivisCamara,
  type ParlamentarLista,
  SENADO_LISTA_ATUAL,
} from '../src/vinculo/listas.js';
import { contarPorCargo, resumoVinculos } from '../src/vinculo/resumo.js';
import { clienteFalso } from './apoio.js';
import { bancoEmMemoria, contar } from './banco-apoio.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const candidatos = lerCandidatos(
  decodificarLatin1(readFileSync(path.join(AQUI, 'fixtures', 'tse-consulta-cand-2026-sintetico.csv'))),
).candidatos;
const sq = (nomeUrna: string) => candidatos.find((c) => c.nomeUrna === nomeUrna)!.sqCandidato;

// Formatos reais das listas (conferidos no GitHub Actions em 07/10/2026); pessoas fictícias.
const urlDeputados = (leg: number, pagina?: number) =>
  `${CAMARA_API}/deputados?idLegislatura=${leg}&itens=100&ordem=ASC&ordenarPor=nome${pagina ? `&pagina=${pagina}` : ''}`;
const deputado = (id: number, nome: string, siglaUf: string, siglaPartido: string, idLegislatura: number) => ({
  id,
  uri: `${CAMARA_API}/deputados/${id}`,
  nome,
  siglaPartido,
  uriPartido: '',
  siglaUf,
  idLegislatura,
  urlFoto: '',
  email: null,
});
const CSV_DEPUTADOS = [
  'uri;nome;idLegislaturaInicial;idLegislaturaFinal;nomeCivil;cpf;siglaSexo;urlRedeSocial;urlWebsite;dataNascimento;dataFalecimento;ufNascimento;municipioNascimento',
  `${CAMARA_API}/deputados/1001;Ana da Saúde;56;57;ANA FICTICIA DE SOUZA;11111111111;F;;;1980-01-01;;MG;Belo Horizonte`,
  `${CAMARA_API}/deputados/1002;Bruno do Povo;57;57;"BRUNO EXEMPLO DA SILVA JÚNIOR";22222222222;M;;;1975-05-05;;MG;Contagem`,
  `${CAMARA_API}/deputados/1003;Daniel;57;57;DANIEL DE TAL;33333333333;M;;;1970-02-02;;SP;São Paulo`,
  `${CAMARA_API}/deputados/1004;Fernando Exemplar;55;57;FERNANDO EXEMPLAR;44444444444;M;;;1965-03-03;;MG;Uberaba`,
  `${CAMARA_API}/deputados/900;Antigo;55;55;OUTRA PESSOA;55555555555;M;;;1950-01-01;;RJ;Rio`,
].join('\r\n');

function clienteListas(): ClienteHttpTexto {
  const json = clienteFalso({
    [urlDeputados(57)]: {
      dados: [deputado(1001, 'Ana da Saúde', 'MG', 'PXA', 57), deputado(1002, 'Bruno do Povo', 'MG', 'PXB', 57)],
      links: [{ rel: 'next', href: urlDeputados(57, 2) }],
    },
    [urlDeputados(57, 2)]: {
      dados: [deputado(1003, 'Daniel', 'SP', 'PXA', 57), deputado(1004, 'Fernando Exemplar', 'MG', 'PXA', 57)],
      links: [{ rel: 'self', href: urlDeputados(57, 2) }],
    },
    // Na legislatura anterior a UF era outra: vale a mais recente.
    [urlDeputados(56)]: { dados: [deputado(1001, 'Ana da Saúde', 'RJ', 'PXZ', 56), deputado(900, 'Antigo', 'RJ', 'PXA', 56)], links: [] },
    [SENADO_LISTA_ATUAL]: {
      ListaParlamentarEmExercicio: {
        Parlamentares: {
          Parlamentar: [
            {
              IdentificacaoParlamentar: {
                CodigoParlamentar: '5001',
                NomeParlamentar: 'Gabi',
                NomeCompletoParlamentar: 'Gabriela Modelo',
                SiglaPartidoParlamentar: 'PXC',
                UfParlamentar: 'SP',
                EmailParlamentar: 'x@senado.leg.br',
              },
              Mandato: {},
            },
            {
              IdentificacaoParlamentar: { CodigoParlamentar: '5002', NomeParlamentar: 'Outro', NomeCompletoParlamentar: 'Outro Senador', UfParlamentar: 'MG' },
            },
          ],
        },
      },
    },
  });
  return {
    ...json,
    async getTexto(url) {
      if (url !== CAMARA_CSV_DEPUTADOS) throw new Error(`URL não prevista: ${url}`);
      return `﻿${CSV_DEPUTADOS}`;
    },
  };
}

async function listas(): Promise<ParlamentarLista[]> {
  const cliente = clienteListas();
  return [
    ...(await listaCamara(cliente, { legislaturas: [56, 57], minimoNaMaisRecente: 4 })),
    ...(await listaSenado(cliente, { minimo: 2 })),
  ];
}

describe('listas oficiais', () => {
  it('Câmara: pagina, fica com a legislatura mais recente e pega só o nome civil do CSV', async () => {
    const camara = await listaCamara(clienteListas(), { legislaturas: [56, 57], minimoNaMaisRecente: 4 });
    expect(camara).toHaveLength(5);
    expect(camara.find((p) => p.id === 'camara:1001')).toEqual({
      id: 'camara:1001',
      casa: 'camara',
      idCasa: '1001',
      nome: 'Ana da Saúde',
      nomeCivil: 'ANA FICTICIA DE SOUZA',
      uf: 'MG',
      partido: 'PXA',
      referencia: '57',
    });
    expect(camara.find((p) => p.id === 'camara:900')).toMatchObject({ uf: 'RJ', referencia: '56', nomeCivil: 'OUTRA PESSOA' });
    const texto = JSON.stringify(camara);
    for (const pessoal of ['11111111111', '1980-01-01', 'Belo Horizonte']) expect(texto).not.toContain(pessoal); // CPF, nascimento
  });

  it('lista menor que o esperado é erro (nunca apaga vínculos por resposta incompleta)', async () => {
    await expect(listaCamara(clienteListas(), { legislaturas: [57], minimoNaMaisRecente: 513 })).rejects.toThrow(/só 4 deputados/);
    await expect(listaSenado(clienteListas())).rejects.toThrow(/só 2 senadores/);
    expect(() => nomesCivisCamara('uri;nome\nx;y')).toThrow(/nomeCivil/);
  });

  it('Senado: aceita um único senador como objeto (conversão XML→JSON)', async () => {
    const cliente = clienteFalso({
      [SENADO_LISTA_ATUAL]: {
        ListaParlamentarEmExercicio: {
          Parlamentares: { Parlamentar: { IdentificacaoParlamentar: { CodigoParlamentar: '1', NomeParlamentar: 'Só', UfParlamentar: 'AC' } } },
        },
      },
    });
    expect(await listaSenado(cliente, { minimo: 1 })).toMatchObject([{ id: 'senado:1', uf: 'AC', nomeCivil: null }]);
  });
});

describe('casamento por nome civil + UF', () => {
  it('normaliza acento, pontuação e caixa', () => {
    expect(normalizarNome('Acácio da Silva Favacho Neto')).toBe(normalizarNome('ACÁCIO DA SILVA FAVACHO NETO'));
    expect(normalizarNome("João D'Ávila-Souza  Jr.")).toBe('JOAO D AVILA SOUZA JR');
  });

  it('liga automaticamente só o par único; o resto vira sugestão (só para eleitos)', async () => {
    const r = casar(candidatos, await listas());
    expect(r.vinculos).toEqual([
      { sqCandidato: sq('ANA DA SAÚDE'), parlamentarId: 'camara:1001', casa: 'camara', metodo: 'nome_civil_uf' },
      { sqCandidato: sq('FERNANDO'), parlamentarId: 'camara:1004', casa: 'camara', metodo: 'nome_civil_uf' }, // deputado eleito senador
      { sqCandidato: sq('GABI'), parlamentarId: 'senado:5001', casa: 'senado', metodo: 'nome_civil_uf' },
      { sqCandidato: sq('DANIEL'), parlamentarId: 'camara:1003', casa: 'camara', metodo: 'nome_civil_uf' }, // não eleito: liga, mas sem revisão
    ].sort((a, b) => a.sqCandidato.localeCompare(b.sqCandidato)));
    // Nome civil diferente, mas nome de urna = nome parlamentar na mesma UF: sugestão, não vínculo.
    expect(r.sugestoes).toEqual([
      expect.objectContaining({ sqCandidato: sq('BRUNO "DO POVO"'), parlamentarId: 'camara:1002', motivo: 'nome_urna_uf' }),
    ]);
    expect(r.sugestoes[0]?.candidato).toBe('BRUNO "DO POVO" (PXB-MG), deputado federal');

    const porCargo = contarPorCargo(candidatos, r);
    expect(porCargo.deputado_federal).toEqual({ eleitos: 2, naCasaDoCargo: 1, soNaOutraCasa: 0, semVinculo: 1, comSugestao: 1 });
    expect(porCargo.senador).toEqual({ eleitos: 1, naCasaDoCargo: 0, soNaOutraCasa: 1, semVinculo: 0, comSugestao: 0 });
  });

  it('homônimos: dois pares ou dois candidatos para o mesmo parlamentar não ligam sozinhos', async () => {
    const lista = await listas();
    const duplicada = [...lista, { ...lista.find((p) => p.id === 'camara:1001')!, id: 'camara:7777', idCasa: '7777' }];
    const r1 = casar(candidatos, duplicada);
    expect(r1.vinculos.some((v) => v.sqCandidato === sq('ANA DA SAÚDE'))).toBe(false);
    expect(r1.sugestoes.filter((s) => s.motivo === 'nome_civil_ambiguo').map((s) => s.parlamentarId)).toEqual(['camara:1001', 'camara:7777']);

    const ana = candidatos.find((c) => c.nomeUrna === 'ANA DA SAÚDE')!;
    const r2 = casar([...candidatos, { ...ana, sqCandidato: '999', nomeUrna: 'OUTRA ANA' }], lista);
    expect(r2.vinculos.some((v) => v.parlamentarId === 'camara:1001')).toBe(false);
  });

  it('ajustes manuais: vincular confirma a sugestão, bloquear desfaz um automático', async () => {
    const manuais = validar(
      ArquivoManuais,
      [
        { sqCandidato: sq('BRUNO "DO POVO"'), parlamentarId: 'camara:1002', acao: 'vincular', nota: 'conferido na página da Câmara' },
        { sqCandidato: sq('DANIEL'), parlamentarId: 'camara:1003', acao: 'bloquear' },
        { sqCandidato: '123', parlamentarId: 'senado:1', acao: 'vincular' },
      ],
      'manuais',
    );
    const r = casar(candidatos, await listas(), manuais);
    expect(r.vinculos).toContainEqual({ sqCandidato: sq('BRUNO "DO POVO"'), parlamentarId: 'camara:1002', casa: 'camara', metodo: 'manual' });
    expect(r.vinculos.some((v) => v.parlamentarId === 'camara:1003')).toBe(false);
    expect(r.sugestoes).toEqual([]);
    expect(r.manuaisSemCandidato).toEqual(['123']);
  });

  it('o arquivo vinculos-manuais.json do repositório é válido', () => {
    const arquivo = JSON.parse(readFileSync(path.join(AQUI, '..', 'vinculos-manuais.json'), 'utf8')) as unknown;
    expect(() => validar(ArquivoManuais, arquivo, 'vinculos-manuais.json')).not.toThrow();
  });

  it('resumo: contagens, sugestões com dados públicos e fontes', async () => {
    const md = resumoVinculos(candidatos, casar(candidatos, await listas()));
    expect(md).toContain('| Deputado federal | 2 | 1 | 0 | 1 | 1 |');
    expect(md).toContain('| Senador | 1 | 0 | 1 | 0 | 0 |');
    expect(md).toContain('Bruno do Povo (PXB-MG), Câmara 1002');
    expect(md).toContain('Fontes: TSE');
  });
});

describe('gravação dos vínculos (Postgres em memória com as migrações)', () => {
  let db: Awaited<ReturnType<typeof bancoEmMemoria>>;
  beforeAll(async () => {
    db = await bancoEmMemoria();
    await gravarCandidatos(db, candidatos);
  }, 60_000);

  it('substitui os vínculos do ano numa transação; anônimo só lê', async () => {
    const { vinculos } = casar(candidatos, await listas());
    expect(await gravarVinculos(db, 2026, vinculos)).toEqual({ antes: 0, depois: 4 });
    expect(await gravarVinculos(db, 2026, vinculos.slice(0, 2))).toEqual({ antes: 4, depois: 2 });
    expect(await contar(db, 'vinculo_parlamentar')).toBe(2);

    // Candidato que não está em candidato_tse: a chave estrangeira falha e nada muda.
    await expect(gravarVinculos(db, 2026, [{ sqCandidato: '1', parlamentarId: 'camara:1', casa: 'camara', metodo: 'manual' }])).rejects.toThrow();
    expect(await contar(db, 'vinculo_parlamentar')).toBe(2);

    await db.exec('set role anon');
    try {
      expect(await contar(db, 'vinculo_parlamentar')).toBe(2);
      await expect(db.exec('delete from public.vinculo_parlamentar')).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec('reset role');
    }
  });
});
