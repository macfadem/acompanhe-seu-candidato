import type { Metadata } from 'next';
import Link from 'next/link';
import { fonteDeDados } from '@/fontes/escolher';
import { ehCasa } from '@/fontes/modelo';
import { ROTULO_CASA } from '@/apresentacao/rotulos';
import { ListaDeVotacoes } from '@/componentes/ListaDeVotacoes';

export const metadata: Metadata = {
  title: 'Votações do Congresso',
  description: 'As votações nominais de plenário mais recentes da Câmara e do Senado, com o resultado e o voto de cada parlamentar.',
};

type Props = { searchParams: Promise<{ casa?: string | string[] }> };

const LIMITE = 60;
const FILTROS = [
  ['', 'Todas'],
  ['camara', ROTULO_CASA.camara],
  ['senado', ROTULO_CASA.senado],
] as const;

export default async function PaginaDoCongresso({ searchParams }: Props) {
  const bruto = (await searchParams).casa;
  const valor = Array.isArray(bruto) ? bruto[0] : bruto;
  const casa = valor && ehCasa(valor) ? valor : undefined;
  const { itens, total } = await fonteDeDados().listarVotacoes({ casa, limite: LIMITE });

  return (
    <>
      <header className="abertura">
        <h1>O que o Congresso votou</h1>
        <p>
          As votações nominais de plenário, da mais recente para a mais antiga. Nas votações simbólicas, que são a
          maioria, a fonte oficial não registra o voto de cada parlamentar.
        </p>
      </header>

      <nav aria-label="Filtrar por casa" className="filtros">
        {FILTROS.map(([chave, rotulo]) => (
          <Link key={chave} href={chave ? `/congresso?casa=${chave}` : '/congresso'} aria-current={(casa ?? '') === chave ? 'true' : undefined}>
            {rotulo}
          </Link>
        ))}
      </nav>

      {total === 0 ? (
        <p className="vazio">Nenhuma votação nominal nos dados carregados.</p>
      ) : (
        <>
          <p className="contagem">
            {itens.length < total ? `As ${itens.length} mais recentes de ${total} votações.` : total === 1 ? '1 votação.' : `${total} votações.`}
          </p>
          <ListaDeVotacoes votacoes={itens} />
        </>
      )}
    </>
  );
}
