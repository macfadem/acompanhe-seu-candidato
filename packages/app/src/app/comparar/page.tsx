import type { Metadata } from 'next';
import Link from 'next/link';
import { CATEGORIAS_VOTO } from '@acompanhe/pipeline/tipos';
import { fonteDeDados } from '@/fontes/escolher';
import { buscarParlamentares, MINIMO_DA_BUSCA } from '@/apresentacao/busca';
import {
  caminhoDaVotacao,
  caminhoDeComparar,
  caminhoDoParlamentar,
  formatarData,
  lerIdsParaComparar,
  MAXIMO_PARA_COMPARAR,
  partidoUf,
  tituloDaVotacao,
} from '@/apresentacao/formatos';
import { resumirRegistros, votacoesEmComum } from '@/apresentacao/registros';
import { ROTULO_CASA, ROTULO_VOTO } from '@/apresentacao/rotulos';
import { Busca } from '@/componentes/Busca';
import { CartaoParlamentar } from '@/componentes/CartaoParlamentar';

export const metadata: Metadata = {
  title: 'Comparar lado a lado',
  description: 'De 2 a 5 parlamentares lado a lado: os mesmos campos e como cada um votou nas mesmas votações.',
};

type Props = { searchParams: Promise<{ p?: string | string[]; q?: string | string[] }> };

const LIMITE_DE_LINHAS = 40;
const LIMITE_DA_BUSCA = 20;

export default async function PaginaDeComparar({ searchParams }: Props) {
  const { p, q } = await searchParams;
  const consulta = (Array.isArray(q) ? q[0] : q)?.slice(0, 80).trim() ?? '';
  const fonte = fonteDeDados();
  const todos = await fonte.listarParlamentares();
  const porId = new Map(todos.map((x) => [x.id, x]));

  const escolhidos = lerIdsParaComparar(p).flatMap((id) => porId.get(id) ?? []);
  const ids = escolhidos.map((x) => x.id);
  const lotado = escolhidos.length >= MAXIMO_PARA_COMPARAR;

  const selecionados = await Promise.all(
    escolhidos.map(async (parlamentar) => {
      const registros = await fonte.registrosDoParlamentar(parlamentar.id);
      return { parlamentar, registros, resumo: resumirRegistros(registros) };
    }),
  );
  const categorias = CATEGORIAS_VOTO.filter((c) => selecionados.some((s) => s.resumo.porCategoria[c] > 0));
  const emComum = votacoesEmComum(selecionados);
  const casasDiferentes = new Set(escolhidos.map((x) => x.casa)).size > 1;
  const achados = buscarParlamentares(todos, consulta).filter((x) => !ids.includes(x.id));

  return (
    <>
      <header className="abertura">
        <h1>Comparar lado a lado</h1>
        <p>
          De 2 a {MAXIMO_PARA_COMPARAR} parlamentares, com os mesmos campos para todos e como cada um votou nas mesmas
          votações. Sem nota e sem ranking.
        </p>
      </header>

      {escolhidos.length > 0 ? (
        <ul className="escolhidos" aria-label="Na comparação">
          {escolhidos.map((x) => (
            <li key={x.id}>
              {x.nome}
              <Link href={caminhoDeComparar(ids.filter((id) => id !== x.id))} aria-label={`Tirar ${x.nome} da comparação`}>
                Tirar
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {lotado ? (
        <p className="contagem">A comparação está cheia ({MAXIMO_PARA_COMPARAR}). Tire alguém para incluir outra pessoa.</p>
      ) : (
        <Busca
          acao="/comparar"
          valor={consulta}
          rotulo={escolhidos.length === 0 ? 'Quem você quer comparar?' : 'Incluir mais alguém'}
          manter={ids.map((id) => ({ nome: 'p', valor: id }))}
        />
      )}

      {!lotado && consulta.length >= MINIMO_DA_BUSCA ? (
        <section className="secao" aria-live="polite">
          {achados.length === 0 ? <p className="contagem">Ninguém encontrado para “{consulta}”.</p> : null}
          <ul className="cartoes">
            {achados.slice(0, LIMITE_DA_BUSCA).map((x) => (
              <CartaoParlamentar
                key={x.id}
                parlamentar={x}
                acao={
                  <Link href={caminhoDeComparar([...ids, x.id])} className="botao-leve" aria-label={`Incluir ${x.nome}`}>
                    Incluir
                  </Link>
                }
              />
            ))}
          </ul>
        </section>
      ) : null}

      {escolhidos.length === 1 ? <p className="vazio">Inclua pelo menos mais uma pessoa para comparar.</p> : null}

      {escolhidos.length >= 2 ? (
        <>
          <section className="secao" aria-labelledby="titulo-campos">
            <h2 id="titulo-campos">Os mesmos campos</h2>
            <div className="rolagem" tabIndex={0} role="region" aria-labelledby="titulo-campos">
              <table className="tabela">
                <thead>
                  <tr>
                    <td />
                    {escolhidos.map((x) => (
                      <th key={x.id} scope="col">
                        <Link href={caminhoDoParlamentar(x)}>{x.nome}</Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Casa</th>
                    {escolhidos.map((x) => (
                      <td key={x.id}>{ROTULO_CASA[x.casa]}</td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">Partido e UF</th>
                    {escolhidos.map((x) => (
                      <td key={x.id}>{partidoUf(x.partido, x.uf)}</td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">Votações nominais com registro</th>
                    {selecionados.map((s) => (
                      <td key={s.parlamentar.id}>
                        {s.resumo.comRegistro} de {s.resumo.votacoes}
                      </td>
                    ))}
                  </tr>
                  {categorias.map((c) => (
                    <tr key={c}>
                      <th scope="row">{ROTULO_VOTO[c]}</th>
                      {selecionados.map((s) => (
                        <td key={s.parlamentar.id}>{s.resumo.porCategoria[c]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="secao" aria-labelledby="titulo-comum">
            <h2 id="titulo-comum">Nas mesmas votações</h2>
            {emComum.length === 0 ? (
              <p className="vazio">
                {casasDiferentes
                  ? 'Deputados e senadores votam em plenários diferentes: não há votação em comum entre as duas casas.'
                  : 'Nenhuma votação com registro de pelo menos duas destas pessoas no período coletado.'}
              </p>
            ) : (
              <>
                <p className="contagem">
                  {emComum.length > LIMITE_DE_LINHAS
                    ? `As ${LIMITE_DE_LINHAS} mais recentes de ${emComum.length} votações com registro de pelo menos duas destas pessoas.`
                    : 'Votações com registro de pelo menos duas destas pessoas, da mais recente para a mais antiga.'}
                </p>
                <div className="rolagem" tabIndex={0} role="region" aria-labelledby="titulo-comum">
                  <table className="tabela">
                    <thead>
                      <tr>
                        <th scope="col">Votação</th>
                        {escolhidos.map((x) => (
                          <th key={x.id} scope="col">
                            {x.nome}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {emComum.slice(0, LIMITE_DE_LINHAS).map(({ votacao, votos }) => (
                        <tr key={votacao.id}>
                          <th scope="row">
                            <Link href={caminhoDaVotacao(votacao)}>{tituloDaVotacao(votacao)}</Link>
                            <time dateTime={votacao.data}>{formatarData(votacao.data)}</time>
                          </th>
                          {votos.map((voto, i) => (
                            <td key={escolhidos[i]?.id ?? i}>{voto ? ROTULO_VOTO[voto.categoria] : 'Sem registro'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </>
      ) : null}
    </>
  );
}
