import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fonteDeDados } from '@/fontes/escolher';
import { CASAS } from '@/fontes/modelo';
import { nomeDaUf } from '@/apresentacao/ufs';
import { plural } from '@/apresentacao/formatos';
import { CartaoParlamentar } from '@/componentes/CartaoParlamentar';

type Props = { params: Promise<{ uf: string }> };

const TITULO = { senado: 'Senado Federal', camara: 'Câmara dos Deputados' } as const;
const CARGO = { senado: ['senador(a)', 'senadores'], camara: ['deputado(a) federal', 'deputados federais'] } as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const nome = nomeDaUf((await params).uf);
  return nome ? { title: `Quem representa ${nome}` } : { title: 'Página não encontrada' };
}

export default async function PaginaDaUf({ params }: Props) {
  const sigla = (await params).uf.toUpperCase();
  const nome = nomeDaUf(sigla);
  if (!nome) notFound();

  const daUf = (await fonteDeDados().listarParlamentares()).filter((p) => p.uf === sigla);

  return (
    <>
      <nav aria-label="Navegação" className="caminho">
        <Link href="/">Todos os estados</Link>
      </nav>
      <header className="abertura">
        <h1>Quem representa {nome}</h1>
        <p>
          Os parlamentares de {sigla} que aparecem nas votações nominais do período coletado. Cada estado tem três
          senadores e de 8 a 70 deputados federais, conforme a população.
        </p>
      </header>

      {daUf.length === 0 ? (
        <p className="vazio">
          Nenhum parlamentar de {sigla} nos dados carregados. Se a coleta cobre poucos dias, pode não ter havido
          votação nominal no período.
        </p>
      ) : null}

      {[...CASAS].reverse().map((casa) => {
        const lista = daUf.filter((p) => p.casa === casa);
        if (lista.length === 0) return null;
        return (
          <section key={casa} className="secao" aria-labelledby={`casa-${casa}`}>
            <h2 id={`casa-${casa}`}>{TITULO[casa]}</h2>
            <p className="contagem">{plural(lista.length, CARGO[casa][0], CARGO[casa][1])} com registro no período.</p>
            <ul className="cartoes">
              {lista.map((p) => (
                <CartaoParlamentar key={p.id} parlamentar={p} />
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
