import '@fontsource-variable/atkinson-hyperlegible-next';
import './globals.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { fonteDeDados } from '@/fontes/escolher';
import { AvisoDeExemplo, PeriodoDaColeta } from '@/componentes/OrigemDosDados';

export const metadata: Metadata = {
  title: { default: 'Acompanhe Seu Candidato', template: '%s | Acompanhe Seu Candidato' },
  description:
    'Como votam deputados federais e senadores nas votações nominais de plenário, com link para a fonte oficial em cada registro.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f6f8' },
    { media: '(prefers-color-scheme: dark)', color: '#12151b' },
  ],
};

const REPOSITORIO = 'https://github.com/macfadem/acompanhe-seu-candidato';

export default function Layout({ children }: { children: ReactNode }) {
  const { origem } = fonteDeDados();
  return (
    <html lang="pt-BR">
      <body>
        <a className="pular" href="#conteudo">
          Pular para o conteúdo
        </a>
        <header className="topo">
          <div className="faixa">
            <Link href="/" className="marca">
              Acompanhe Seu Candidato
            </Link>
          </div>
        </header>
        <AvisoDeExemplo origem={origem} />
        <main id="conteudo" className="faixa conteudo">
          {children}
        </main>
        <footer className="rodape">
          <div className="faixa">
            <PeriodoDaColeta origem={origem} />
            <p>
              Fontes oficiais: <a href="https://dadosabertos.camara.leg.br">Dados Abertos da Câmara dos Deputados</a> e{' '}
              <a href="https://legis.senado.leg.br/dadosabertos">Dados Abertos do Senado Federal</a>.
            </p>
            <p>
              Projeto independente: não é um site oficial da Câmara, do Senado ou do TSE.{' '}
              <a href={REPOSITORIO}>Código aberto</a>, licença MIT.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
