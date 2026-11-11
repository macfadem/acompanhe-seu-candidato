import { describe, expect, it } from 'vitest';
import { buscarParlamentares, normalizar } from '../src/apresentacao/busca';
import { nomeDaUf } from '../src/apresentacao/ufs';
import { parlamentar } from './apoio';

const lista = [
  parlamentar('camara:1', 'João D’Ávila', { partido: 'PEX', uf: 'SP' }),
  parlamentar('camara:2', 'Maria da Conceição', { partido: 'PFI', uf: 'MG' }),
  parlamentar('senado:3', 'Joana Paz', { partido: 'PEX', uf: 'MG' }),
  parlamentar('senado:4', 'Sem Sigla', { partido: null, uf: null }),
];
const nomes = (q: string) => buscarParlamentares(lista, q).map((p) => p.nome);

describe('normalizar', () => {
  it('tira acentos, caixa e espaços sobrando', () => {
    expect(normalizar('  JOÃO   D’Ávila ')).toBe('joao d’avila');
    expect(normalizar('Conceição')).toBe('conceicao');
  });
});

describe('buscarParlamentares', () => {
  it('encontra pelo nome com ou sem acento', () => {
    expect(nomes('joao')).toEqual(['João D’Ávila']);
    expect(nomes('CONCEIÇÃO')).toEqual(['Maria da Conceição']);
  });

  it('exige todas as palavras, em qualquer ordem', () => {
    expect(nomes('conceicao maria')).toEqual(['Maria da Conceição']);
    expect(nomes('maria paz')).toEqual([]);
  });

  it('encontra pela sigla e pelo nome da UF', () => {
    expect(nomes('mg')).toEqual(['Maria da Conceição', 'Joana Paz']);
    expect(nomes('minas gerais')).toEqual(['Maria da Conceição', 'Joana Paz']);
  });

  it('encontra pela sigla do partido', () => {
    expect(nomes('pex')).toEqual(['João D’Ávila', 'Joana Paz']);
  });

  it('menos de 2 letras não busca; sigla solta não casa com pedaço de nome alheio', () => {
    expect(nomes('j')).toEqual([]);
    expect(nomes('  ')).toEqual([]);
    expect(nomes('sp')).toEqual(['João D’Ávila']);
  });
});

describe('nomeDaUf', () => {
  it('aceita qualquer caixa e devolve null para sigla que não existe', () => {
    expect(nomeDaUf('mg')).toBe('Minas Gerais');
    expect(nomeDaUf('XX')).toBeNull();
  });
});
