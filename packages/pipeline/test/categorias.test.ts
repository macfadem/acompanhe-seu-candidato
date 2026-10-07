import { describe, expect, it } from 'vitest';
import { classificarVotoCamara, classificarVotoSenado } from '../src/categorias.js';

describe('classificarVotoCamara', () => {
  it.each([
    ['Sim', 'sim'],
    ['Não', 'nao'],
    ['NÃO', 'nao'],
    ['Abstenção', 'abstencao'],
    ['Obstrução', 'obstrucao'],
    ['Art. 17', 'presidente'],
    ['Artigo 17', 'presidente'],
  ])('"%s" → %s', (valor, categoria) => {
    expect(classificarVotoCamara(valor)).toEqual({ categoria, conhecido: true });
  });

  it('valor desconhecido vira "outro" e fica marcado para revisão', () => {
    expect(classificarVotoCamara('Voto em branco')).toEqual({ categoria: 'outro', conhecido: false });
  });
});

describe('classificarVotoSenado', () => {
  it.each([
    ['Sim', null, 'sim'],
    ['Não', null, 'nao'],
    ['Abstenção', null, 'abstencao'],
    ['Votou', null, 'secreto'],
    ['AP', 'Atividade parlamentar', 'ausente_justificado'],
    ['MIS', 'Missão da Casa no País/exterior', 'ausente_justificado'],
    ['LS', 'Licença saúde', 'licenca'],
    ['LP', 'Licença Particular', 'licenca'],
    ['LAP', 'Licença paternidade ou ao adotante', 'licenca'],
    ['P-NRV', 'Presente – Não registrou voto', 'presente_sem_voto'],
    ['Presidente (art. 51 RISF)', null, 'presidente'],
  ])('"%s" → %s', (sigla, descricao, categoria) => {
    expect(classificarVotoSenado(sigla, descricao)).toEqual({ categoria, conhecido: true });
  });

  it('código novo (exemplo hipotético) usa a descrição oficial, mas segue marcado para revisão', () => {
    expect(classificarVotoSenado('LG', 'Licença gestante')).toEqual({ categoria: 'licenca', conhecido: false });
    expect(classificarVotoSenado('XPTO', 'Missão oficial')).toEqual({
      categoria: 'ausente_justificado',
      conhecido: false,
    });
  });

  it('código novo sem descrição útil vira "outro"', () => {
    expect(classificarVotoSenado('XPTO', null)).toEqual({ categoria: 'outro', conhecido: false });
  });
});
