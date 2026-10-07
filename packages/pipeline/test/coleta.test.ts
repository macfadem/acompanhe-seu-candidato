import { describe, expect, it } from 'vitest';
import { coletar } from '../src/coleta.js';
import { urlVotacoesSenado } from '../src/senado.js';
import { clienteFalso, fixture } from './apoio.js';

describe('coletar', () => {
  it('ordena votações por data e votos na mesma ordem', async () => {
    const respostaInvertida = [...(fixture('senado-votacao-2026-06.json') as unknown[])].reverse();
    const cliente = clienteFalso({ [urlVotacoesSenado('2026-06-01', '2026-06-30')]: respostaInvertida });
    const coleta = await coletar({ de: '2026-06-01', ate: '2026-06-30', casas: ['senado'], cliente });
    expect(coleta.votacoes.map((v) => v.data)).toEqual(['2026-06-09', '2026-06-10', '2026-06-16']);
    expect(coleta.votos[0]?.votacaoId).toBe('senado:7092');
    expect(coleta.votos.at(-1)?.votacaoId).toBe('senado:7095');
  });

  it('Senado sem votações no período (corpo vazio) não é erro', async () => {
    const cliente = clienteFalso({ [urlVotacoesSenado('2026-07-20', '2026-07-31')]: null });
    const coleta = await coletar({ de: '2026-07-20', ate: '2026-07-31', casas: ['senado'], cliente });
    expect(coleta.votacoes).toEqual([]);
  });

  it('recusa datas inválidas antes de chamar a rede', async () => {
    const cliente = clienteFalso({});
    await expect(coletar({ de: '2026-02-30', ate: '2026-03-01', cliente })).rejects.toThrow(/inexistente/);
    expect(cliente.chamadas).toEqual([]);
  });

  it('falha alto se a resposta inteira mudar de formato (não é mais uma lista)', async () => {
    const cliente = clienteFalso({ [urlVotacoesSenado('2026-06-01', '2026-06-30')]: { erro: 'formato novo' } });
    await expect(coletar({ de: '2026-06-01', ate: '2026-06-30', casas: ['senado'], cliente })).rejects.toThrow(
      /Formato inesperado/,
    );
  });

  it('uma votação de plenário fora do formato fica de fora, com aviso; as outras seguem', async () => {
    const resposta = [
      ...(fixture('senado-votacao-2026-06.json') as unknown[]),
      { codigoSessaoVotacao: 9999, dataSessao: 20260617, informeLegislativo: { siglaColegiado: 'PLEN' } },
    ];
    const cliente = clienteFalso({ [urlVotacoesSenado('2026-06-01', '2026-06-30')]: resposta });
    const coleta = await coletar({ de: '2026-06-01', ate: '2026-06-30', casas: ['senado'], cliente });
    expect(coleta.votacoes).toHaveLength(3);
    expect(coleta.avisos).toEqual([
      expect.objectContaining({
        tipo: 'formato_inesperado',
        votacaoId: 'senado:9999',
        detalhe: expect.stringContaining('dataSessao'),
      }),
    ]);
  });

  it('votação de comissão fora do formato é ignorada sem aviso (fora do MVP)', async () => {
    const resposta = [{ codigoSessaoVotacao: 9998, informeLegislativo: { siglaColegiado: 'CCJ' } }];
    const cliente = clienteFalso({ [urlVotacoesSenado('2026-06-01', '2026-06-30')]: resposta });
    const coleta = await coletar({ de: '2026-06-01', ate: '2026-06-30', casas: ['senado'], cliente });
    expect(coleta.avisos).toEqual([]);
  });
});
