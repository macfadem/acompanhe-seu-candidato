import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Entenda os cargos',
  description: 'O que faz um deputado federal e um senador, e o que cada votação significa, com a referência na Constituição.',
};

const CONSTITUICAO = 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm';

const CARGOS = [
  {
    id: 'deputado',
    cargo: 'Deputado federal',
    casa: 'Câmara dos Deputados',
    fatos: [
      ['Representa', 'o povo', 'art. 45'],
      ['Mandato', '4 anos', 'art. 44, parágrafo único'],
      ['Quantos são', '513 hoje; cada estado e o Distrito Federal têm de 8 a 70, conforme a população', 'art. 45, § 1º, e Lei Complementar nº 78/1993'],
      ['Eleição', 'proporcional: as vagas são divididas entre os partidos conforme os votos', 'art. 45'],
    ],
    faz: [
      ['Propõe, discute e vota leis, junto com o Senado.', 'arts. 48 e 61'],
      ['Fiscaliza os atos do Poder Executivo, junto com o Senado.', 'art. 49, X'],
      ['A Câmara autoriza, por dois terços, a abertura de processo contra o presidente da República.', 'art. 51, I'],
    ],
  },
  {
    id: 'senador',
    cargo: 'Senador',
    casa: 'Senado Federal',
    fatos: [
      ['Representa', 'os estados e o Distrito Federal', 'art. 46'],
      ['Mandato', '8 anos', 'art. 46, § 1º'],
      ['Quantos são', '81: três por estado e pelo Distrito Federal', 'art. 46, § 1º'],
      ['Eleição', 'majoritária; a cada quatro anos renova-se um terço ou dois terços do Senado', 'art. 46, § 2º'],
    ],
    faz: [
      ['Propõe, discute e vota leis, junto com a Câmara.', 'arts. 48 e 61'],
      ['O Senado processa e julga o presidente da República nos crimes de responsabilidade.', 'art. 52, I'],
      ['Aprova, em votação secreta, indicações como as de ministros do Supremo Tribunal Federal e de chefes de missão diplomática.', 'art. 52, III e IV'],
    ],
  },
] as const;

const VOTACOES = [
  ['Votação nominal', 'O voto de cada parlamentar fica registrado. É o que este site mostra.'],
  ['Votação simbólica', 'O resultado é proclamado sem registro individual. É a maioria das votações, e por isso elas não aparecem aqui.'],
  ['Votação secreta', 'A fonte oficial informa quem votou, mas não a escolha.'],
  ['Emenda à Constituição', 'Precisa de três quintos dos votos, em dois turnos, em cada casa (art. 60, § 2º).'],
  ['Lei complementar', 'Precisa da maioria absoluta: mais da metade de todos os membros da casa (art. 69).'],
] as const;

export default function PaginaDosCargos() {
  return (
    <>
      <header className="abertura">
        <h1>Entenda os cargos</h1>
        <p>
          O Congresso Nacional tem duas casas, a Câmara dos Deputados e o Senado Federal. Cada regra abaixo traz o
          artigo da <a href={CONSTITUICAO}>Constituição Federal</a> de onde vem.
        </p>
      </header>

      {CARGOS.map((c) => (
        <section key={c.id} className="secao cargo" aria-labelledby={`cargo-${c.id}`}>
          <p className="sobretitulo">{c.casa}</p>
          <h2 id={`cargo-${c.id}`}>{c.cargo}</h2>
          <dl className="fatos">
            {c.fatos.map(([rotulo, valor, artigo]) => (
              <div key={rotulo}>
                <dt>{rotulo}</dt>
                <dd>
                  {valor} <cite>({artigo})</cite>
                </dd>
              </div>
            ))}
          </dl>
          <h3>O que faz</h3>
          <ul className="lista">
            {c.faz.map(([texto, artigo]) => (
              <li key={texto}>
                {texto} <cite>({artigo})</cite>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="secao" aria-labelledby="titulo-tipos">
        <h2 id="titulo-tipos">Os tipos de votação</h2>
        <dl className="fatos">
          {VOTACOES.map(([rotulo, texto]) => (
            <div key={rotulo}>
              <dt>{rotulo}</dt>
              <dd>{texto}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
