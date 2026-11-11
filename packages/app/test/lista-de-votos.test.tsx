import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ListaDeVotos } from '../src/componentes/ListaDeVotos';
import { votacao, voto } from './apoio';

const senado = votacao('senado:7990001', '2026-10-29', {
  urlFonte: 'https://legis.senado.leg.br/dadosabertos/',
  proposicao: {
    sigla: 'PLP',
    numero: '120',
    ano: 2026,
    ementa: 'Ementa sintética.',
    idCasa: '1',
    url: 'https://www25.senado.leg.br/',
  },
  placar: { sim: 61, nao: 9, abstencao: 1 },
});

function renderizar(props: ComponentProps<typeof ListaDeVotos>) {
  return renderToStaticMarkup(<ListaDeVotos {...props} />);
}

describe('ListaDeVotos', () => {
  it('mostra data, título, rótulo neutro, valor original da fonte, resultado e links oficiais', () => {
    const html = renderizar({
      parlamentar: { partido: 'PEX', uf: 'PE' },
      itens: [
        {
          votacao: senado,
          voto: voto(senado.id, 'senado:9902', {
            categoria: 'ausente_justificado',
            valorOriginal: 'AP',
            motivo: 'Atividade parlamentar',
            uf: 'PE',
          }),
        },
      ],
    });
    expect(html).toContain('<time');
    expect(html).toContain('29/10/2026');
    expect(html).toContain('PLP 120/2026');
    expect(html).toContain('Ausente em atividade parlamentar ou missão');
    expect(html).toContain('Na fonte: “AP” (Atividade parlamentar)');
    expect(html).toContain('Aprovada: Sim 61, Não 9, Abstenção 1');
    expect(html).toContain('href="https://legis.senado.leg.br/dadosabertos/">Ver na fonte oficial');
    expect(html).toContain('href="https://www25.senado.leg.br/">Ver a proposição');
    expect(html).not.toContain('Partido e UF na data');
  });

  it('avisa o partido e a UF da data quando mudaram depois', () => {
    const html = renderizar({
      parlamentar: { partido: 'PFI', uf: 'SP' },
      itens: [{ votacao: senado, voto: voto(senado.id, 'camara:2', { partido: 'PEX', uf: 'SP' }) }],
    });
    expect(html).toContain('Partido e UF na data: PEX-SP');
  });

  it('votação secreta na Câmara (a fonte não informa o valor) não inventa um', () => {
    const html = renderizar({
      parlamentar: { partido: 'PEX', uf: 'MG' },
      itens: [{ votacao: senado, voto: voto(senado.id, 'camara:1', { categoria: 'secreto', valorOriginal: null }) }],
    });
    expect(html).toContain('Votou (votação secreta)');
    expect(html).not.toContain('Na fonte:');
  });

  it('sem proposição identificada, a descrição vira o título e não se repete', () => {
    const v = votacao('camara:5-1', '2026-09-23', { proposicao: null, descricao: 'Aprovado requerimento sintético.' });
    const html = renderizar({ parlamentar: { partido: 'PEX', uf: 'MG' }, itens: [{ votacao: v, voto: voto(v.id, 'camara:1') }] });
    expect(html.split('Aprovado requerimento sintético.')).toHaveLength(2);
  });

  it('sem votos, explica por que (votações simbólicas não registram voto individual)', () => {
    const html = renderizar({ parlamentar: { partido: 'PEX', uf: 'MG' }, itens: [] });
    expect(html).toContain('Nenhum voto nominal de plenário no período coletado');
    expect(html).toContain('simbólicas');
  });
});
