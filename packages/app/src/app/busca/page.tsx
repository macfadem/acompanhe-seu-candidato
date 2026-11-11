import type { Metadata } from 'next';
import { fonteDeDados } from '@/fontes/escolher';
import { buscarParlamentares, MINIMO_DA_BUSCA } from '@/apresentacao/busca';
import { plural } from '@/apresentacao/formatos';
import { Busca } from '@/componentes/Busca';
import { CartaoParlamentar } from '@/componentes/CartaoParlamentar';

export const metadata: Metadata = { title: 'Buscar parlamentar' };

type Props = { searchParams: Promise<{ q?: string | string[] }> };

const LIMITE = 60;

export default async function PaginaDeBusca({ searchParams }: Props) {
  const { q } = await searchParams;
  const consulta = (Array.isArray(q) ? q[0] : q)?.slice(0, 80).trim() ?? '';
  const achados = buscarParlamentares(await fonteDeDados().listarParlamentares(), consulta);

  return (
    <>
      <header className="abertura">
        <h1>Buscar parlamentar</h1>
      </header>
      <Busca acao="/busca" valor={consulta} rotulo="Nome, partido ou estado" />

      {consulta.length >= MINIMO_DA_BUSCA ? (
        <section className="secao" aria-live="polite">
          <p className="contagem">
            {achados.length === 0
              ? `Ninguém encontrado para “${consulta}”. Confira a grafia ou busque pela sigla do estado.`
              : achados.length > LIMITE
                ? `Os primeiros ${LIMITE} de ${achados.length} resultados para “${consulta}”.`
                : `${plural(achados.length, 'resultado', 'resultados')} para “${consulta}”.`}
          </p>
          <ul className="cartoes">
            {achados.slice(0, LIMITE).map((p) => (
              <CartaoParlamentar key={p.id} parlamentar={p} />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
