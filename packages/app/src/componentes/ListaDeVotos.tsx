import type { Parlamentar, VotoNaVotacao } from '@/fontes/modelo';
import { ROTULO_RESULTADO, ROTULO_VOTO } from '@/apresentacao/rotulos';
import { formatarData, formatarPlacar, partidoUf, tituloDaVotacao } from '@/apresentacao/formatos';
import estilos from './ListaDeVotos.module.css';

interface Props {
  parlamentar: Pick<Parlamentar, 'partido' | 'uf'>;
  itens: readonly VotoNaVotacao[];
}

/**
 * Os votos de um parlamentar, do mais recente para o mais antigo. Todo registro tem o mesmo
 * formato e o mesmo carimbo, seja qual for o voto, e termina no link para a fonte oficial.
 */
export function ListaDeVotos({ parlamentar, itens }: Props) {
  if (itens.length === 0) {
    return (
      <p className={estilos.vazio}>
        Nenhum voto nominal de plenário no período coletado. Nas votações simbólicas, que são a maioria, a fonte
        oficial não registra o voto de cada parlamentar.
      </p>
    );
  }

  return (
    <ol className={estilos.lista}>
      {itens.map(({ votacao, voto }) => {
        const idTitulo = `votacao-${votacao.id.replace(/[^A-Za-z0-9-]/g, '-')}`;
        const partidoMudou = voto.partido !== parlamentar.partido || voto.uf !== parlamentar.uf;
        return (
          <li key={votacao.id} className={estilos.registro}>
            <article aria-labelledby={idTitulo} className={estilos.artigo}>
              <time className={estilos.data} dateTime={votacao.data}>
                {formatarData(votacao.data)}
              </time>
              <div className={estilos.corpo}>
                <h3 id={idTitulo} className={estilos.titulo}>
                  {tituloDaVotacao(votacao)}
                </h3>
                {votacao.proposicao?.ementa ? <p className={estilos.ementa}>{votacao.proposicao.ementa}</p> : null}
                {votacao.proposicao ? <p className={estilos.descricao}>{votacao.descricao}</p> : null}

                <p className={estilos.voto}>
                  <span className={estilos.carimbo}>{ROTULO_VOTO[voto.categoria]}</span>
                  {voto.valorOriginal !== null ? (
                    <span className={estilos.original}>
                      Na fonte: “{voto.valorOriginal}”{voto.motivo ? ` (${voto.motivo})` : null}
                    </span>
                  ) : null}
                </p>

                <p className={estilos.resultado}>
                  {ROTULO_RESULTADO[votacao.resultado]}
                  {votacao.placar ? `: ${formatarPlacar(votacao.placar)}` : null}
                </p>
                {partidoMudou ? (
                  <p className={estilos.nota}>Partido e UF na data: {partidoUf(voto.partido, voto.uf)}</p>
                ) : null}

                <p className={estilos.links}>
                  <a href={votacao.urlFonte}>Ver na fonte oficial</a>
                  {votacao.proposicao?.url ? <a href={votacao.proposicao.url}>Ver a proposição</a> : null}
                </p>
              </div>
            </article>
          </li>
        );
      })}
    </ol>
  );
}
