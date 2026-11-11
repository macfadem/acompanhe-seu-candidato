import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { fonteDeDados } from '@/fontes/escolher';
import { LIMITE_PADRAO } from '@/fontes/coleta';
import { ehCasa } from '@/fontes/modelo';
import { ROTULO_CASA } from '@/apresentacao/rotulos';
import { descreverContagem, formatarData, partidoUf } from '@/apresentacao/formatos';
import { Legenda } from '@/componentes/Legenda';
import { ListaDeVotos } from '@/componentes/ListaDeVotos';

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

  const { itens, total } = await fonteDeDados().votosDoParlamentar(parlamentar.id, { limite: LIMITE_PADRAO });
  const contagem = descreverContagem(itens.length, total);

  return (
    <>
      <nav aria-label="Navegação" className="caminho">
        <Link href="/">Todos os parlamentares</Link>
      </nav>

      <header className="parlamentar">
        <h1>{parlamentar.nome}</h1>
        <p className="identificacao">
          {ROTULO_CASA[parlamentar.casa]}, {partidoUf(parlamentar.partido, parlamentar.uf)}
        </p>
        <p className="referencia">
          Partido e UF como registrados na votação de {formatarData(parlamentar.referenciaData)}.
        </p>
      </header>

      <section className="votos" aria-labelledby="titulo-votos">
        <h2 id="titulo-votos">Votações nominais de plenário</h2>
        {contagem ? <p className="contagem">{contagem}</p> : null}
        <ListaDeVotos parlamentar={parlamentar} itens={itens} />
      </section>

      <Legenda />
    </>
  );
}
