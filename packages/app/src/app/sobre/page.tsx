import type { Metadata } from 'next';
import Link from 'next/link';
import { fonteDeDados } from '@/fontes/escolher';
import { Legenda } from '@/componentes/Legenda';
import { PeriodoDaColeta } from '@/componentes/OrigemDosDados';

export const metadata: Metadata = {
  title: 'Sobre o site',
  description: 'De onde vêm os dados, o que o site mostra e o que ele não faz.',
};

const REPOSITORIO = 'https://github.com/macfadem/acompanhe-seu-candidato';

export default function PaginaSobre() {
  const { origem } = fonteDeDados();
  return (
    <>
      <header className="abertura">
        <h1>Sobre o site</h1>
        <p>
          O Acompanhe Seu Candidato mostra como deputados federais e senadores votam no plenário, para quem quer
          acompanhar o mandato de quem elegeu.
        </p>
      </header>

      <section className="secao" aria-labelledby="titulo-fontes">
        <h2 id="titulo-fontes">De onde vêm os dados</h2>
        <ul className="lista">
          <li>
            <a href="https://dadosabertos.camara.leg.br">Dados Abertos da Câmara dos Deputados</a>
          </li>
          <li>
            <a href="https://legis.senado.leg.br/dadosabertos">Dados Abertos do Senado Federal</a>
          </li>
        </ul>
        <PeriodoDaColeta origem={origem} />
        {origem.tipo === 'exemplo' ? (
          <p>
            <strong>Esta versão mostra dados de exemplo:</strong> nomes, partidos e votos são fictícios. Para ver
            votações reais, gere um arquivo com a coleta e aponte <code>DADOS_ARQUIVO</code> para ele (veja o README).
          </p>
        ) : null}
        <p>Cada voto mostra o valor original da fonte e leva à página oficial da votação.</p>
      </section>

      <section className="secao" aria-labelledby="titulo-regras">
        <h2 id="titulo-regras">O que o site faz e o que não faz</h2>
        <ul className="lista">
          <li>Usa os mesmos campos, os mesmos rótulos e o mesmo estilo para todos os parlamentares.</li>
          <li>Mostra contagens do que a fonte registra. Não calcula nota, índice nem ranking.</li>
          <li>Não usa cores de partido e não recomenda candidato.</li>
          <li>Não pede cadastro e não guarda dados de quem visita.</li>
        </ul>
      </section>

      <section className="secao" aria-labelledby="titulo-limites">
        <h2 id="titulo-limites">Limites que vale conhecer</h2>
        <ul className="lista">
          <li>Só entram votações nominais de plenário. As simbólicas não registram o voto de cada um.</li>
          <li>
            A Câmara não lista quem não votou. Por isso “sem registro” não é o mesmo que falta: o mandato pode não
            estar em exercício naquele dia.
          </li>
          <li>Partido e UF são os registrados na votação mais recente de cada parlamentar.</li>
        </ul>
        <p>
          Veja também <Link href="/cargos">o que faz cada cargo</Link>.
        </p>
      </section>

      <Legenda aberta />

      <section className="secao" aria-labelledby="titulo-projeto">
        <h2 id="titulo-projeto">O projeto</h2>
        <p>
          Projeto independente: não é um site oficial da Câmara, do Senado ou do TSE. O <a href={REPOSITORIO}>código é aberto</a>,
          com licença MIT.
        </p>
      </section>
    </>
  );
}
