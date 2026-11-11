import '@fontsource-variable/atkinson-hyperlegible-next';
import './globals.css';
import './aplicativo.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { fonteDeDados } from '@/fontes/escolher';
import { Abas } from '@/componentes/Abas';
import { AvisoDeExemplo } from '@/componentes/OrigemDosDados';

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
            <Abas />
          </div>
        </header>
        <AvisoDeExemplo origem={origem} />
        <main id="conteudo" className="faixa conteudo">
          {children}
        </main>
        <footer className="rodape">
          <div className="faixa">
            <p>
              Dados oficiais da <a href="https://dadosabertos.camara.leg.br">Câmara</a> e do{' '}
              <a href="https://legis.senado.leg.br/dadosabertos">Senado</a>. Projeto independente, de{' '}
              <a href={REPOSITORIO}>código aberto</a>. <Link href="/sobre">Como funciona</Link>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
