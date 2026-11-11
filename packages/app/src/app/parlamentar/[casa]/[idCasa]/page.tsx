import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { fonteDeDados } from '@/fontes/escolher';
import { LIMITE_PADRAO } from '@/fontes/coleta';
import { ehCasa } from '@/fontes/modelo';
import { ROTULO_CASA } from '@/apresentacao/rotulos';
import { caminhoDaUf, caminhoDeComparar, descreverContagem, formatarData, partidoUf } from '@/apresentacao/formatos';
import { resumirRegistros } from '@/apresentacao/registros';
import { nomeDaUf } from '@/apresentacao/ufs';
import { Monograma } from '@/componentes/CartaoParlamentar';
import { GradeDeRegistros } from '@/componentes/GradeDeRegistros';
import { Legenda } from '@/componentes/Legenda';
import { ListaDeVotos } from '@/componentes/ListaDeVotos';
import { Numeros } from '@/componentes/Numeros';

type Props = { params: Promise<{ casa: string; idCasa: string }> };

/** A página e os metadados pedem o mesmo parlamentar: `cache` faz uma leitura só por requisição. */
const carregarParlamentar = cache(async (casa: string, idCasa: string) => {
  if (!ehCasa(casa) || !/^\d{1,12}$/.test(idCasa)) return null;
  return fonteDeDados().buscarParlamentar(casa, idCasa);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { casa, idCasa } = await params;
  const parlamentar = await carregarParlamentar(casa, idCasa);
  if (!parlamentar) return { title: 'Página não encontrada' };
  return {
    title: parlamentar.nome,
    description: `Votos de ${parlamentar.nome} (${ROTULO_CASA[parlamentar.casa]}) nas votações nominais de plenário, com link para a fonte oficial.`,
  };
}

export default async function PaginaDoParlamentar({ params }: Props) {
  const { casa, idCasa } = await params;
  const parlamentar = await carregarParlamentar(casa, idCasa);
  if (!parlamentar) notFound();

  const fonte = fonteDeDados();
  const [{ itens, total }, registros] = await Promise.all([
    fonte.votosDoParlamentar(parlamentar.id, { limite: LIMITE_PADRAO }),
    fonte.registrosDoParlamentar(parlamentar.id),
  ]);
  const contagem = descreverContagem(itens.length, total);
  const nomeUf = parlamentar.uf ? nomeDaUf(parlamentar.uf) : null;

  return (
    <>
      <nav aria-label="Navegação" className="caminho">
        {parlamentar.uf && nomeUf ? <Link href={caminhoDaUf(parlamentar.uf)}>{nomeUf}</Link> : <Link href="/">Início</Link>}
      </nav>

      <header className="cracha">
        <Monograma nome={parlamentar.nome} grande />
        <div>
          <p className="cracha-cargo">{parlamentar.casa === 'camara' ? 'Deputado(a) federal' : 'Senador(a)'}</p>
          <h1>{parlamentar.nome}</h1>
          <p className="identificacao">
            {ROTULO_CASA[parlamentar.casa]}, {partidoUf(parlamentar.partido, parlamentar.uf)}
          </p>
          <p className="referencia">
            Partido e UF como registrados na votação de {formatarData(parlamentar.referenciaData)}.
          </p>
        </div>
        <Link href={caminhoDeComparar([parlamentar.id])} className="botao">
          Comparar com outro parlamentar
        </Link>
      </header>

      <section className="secao" aria-labelledby="titulo-numeros">
        <h2 id="titulo-numeros">O período em números</h2>
        <Numeros resumo={resumirRegistros(registros)} />
      </section>

      <section className="secao" aria-labelledby="titulo-grade">
        <h2 id="titulo-grade">Registro em cada votação</h2>
        <p className="contagem">
          Um quadrado por votação nominal de plenário da casa, da mais antiga para a mais recente. Toque para abrir a
          votação.
        </p>
        <GradeDeRegistros registros={registros} />
        {parlamentar.casa === 'camara' ? (
          <p className="nota-fonte">
            A Câmara não lista quem não votou: “sem registro” pode ser ausência ou um dia em que o mandato não estava
            em exercício.
          </p>
        ) : null}
      </section>

      <section className="secao" aria-labelledby="titulo-votos">
        <h2 id="titulo-votos">Votações nominais de plenário</h2>
        {contagem ? <p className="contagem">{contagem}</p> : null}
        <ListaDeVotos parlamentar={parlamentar} itens={itens} />
      </section>

      <Legenda />
    </>
  );
}
