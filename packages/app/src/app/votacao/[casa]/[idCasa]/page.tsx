import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { CATEGORIAS_VOTO } from '@acompanhe/pipeline/tipos';
import { fonteDeDados } from '@/fontes/escolher';
import { ehCasa } from '@/fontes/modelo';
import { caminhoDoParlamentar, formatarData, formatarPlacar, partidoUf, plural, tituloDaVotacao } from '@/apresentacao/formatos';
import { ROTULO_CASA, ROTULO_RESULTADO, ROTULO_VOTO } from '@/apresentacao/rotulos';
import { Legenda } from '@/componentes/Legenda';

type Props = { params: Promise<{ casa: string; idCasa: string }> };

const carregar = cache(async (casa: string, idCasa: string) => {
  if (!ehCasa(casa) || !/^[0-9]{1,12}(-[0-9]{1,6})?$/.test(idCasa)) return null;
  return fonteDeDados().buscarVotacao(casa, idCasa);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { casa, idCasa } = await params;
  const detalhe = await carregar(casa, decodeURIComponent(idCasa));
  if (!detalhe) return { title: 'Página não encontrada' };
  const { votacao } = detalhe;
  return { title: `${tituloDaVotacao(votacao).slice(0, 60)}, ${formatarData(votacao.data)}` };
}

export default async function PaginaDaVotacao({ params }: Props) {
  const { casa, idCasa } = await params;
  const detalhe = await carregar(casa, decodeURIComponent(idCasa));
  if (!detalhe) notFound();
  const { votacao, votos } = detalhe;

  const grupos = CATEGORIAS_VOTO.map((categoria) => ({ categoria, itens: votos.filter((v) => v.voto.categoria === categoria) })).filter(
    (g) => g.itens.length > 0,
  );

  return (
    <>
      <nav aria-label="Navegação" className="caminho">
        <Link href="/congresso">Votações do Congresso</Link>
      </nav>

      <header className="abertura">
        <p className="sobretitulo">
          {ROTULO_CASA[votacao.casa]}, <time dateTime={votacao.data}>{formatarData(votacao.data)}</time>
        </p>
        <h1>{tituloDaVotacao(votacao)}</h1>
        {votacao.proposicao?.ementa ? <p>{votacao.proposicao.ementa}</p> : null}
        {votacao.proposicao ? <p className="descricao">{votacao.descricao}</p> : null}
      </header>

      <p className="resultado">
        <span className="carimbo">{ROTULO_RESULTADO[votacao.resultado]}</span>
        {votacao.placar ? <span>{formatarPlacar(votacao.placar)}</span> : null}
        {votacao.secreta ? <span>Votação secreta: a fonte informa quem votou, não a escolha.</span> : null}
      </p>
      <p className="links">
        <a href={votacao.urlFonte}>Ver na fonte oficial</a>
        {votacao.proposicao?.url ? <a href={votacao.proposicao.url}>Ver a proposição</a> : null}
      </p>

      <section className="secao" aria-labelledby="titulo-registros">
        <h2 id="titulo-registros">Como cada um votou</h2>
        <p className="contagem">{plural(votos.length, 'registro', 'registros')} nos dados carregados, em ordem alfabética.</p>
        {grupos.map(({ categoria, itens }) => (
          <section key={categoria} className="grupo" aria-labelledby={`grupo-${categoria}`}>
            <h3 id={`grupo-${categoria}`}>
              {ROTULO_VOTO[categoria]} <span>{itens.length}</span>
            </h3>
            <ul className="nomes">
              {itens.map(({ voto, parlamentar }) => (
                <li key={parlamentar.id}>
                  <Link href={caminhoDoParlamentar(parlamentar)}>{parlamentar.nome}</Link>
                  <span className="sigla">{partidoUf(voto.partido, voto.uf)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </section>

      <Legenda />
    </>
  );
}
