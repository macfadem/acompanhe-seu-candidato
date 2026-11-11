'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const traco = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

function Icone({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false" {...traco}>
      {children}
    </svg>
  );
}

const ABAS = [
  {
    href: '/',
    rotulo: 'Início',
    tambem: ['/uf', '/busca', '/parlamentar'],
    icone: <path d="M12 21s-6.5-5.6-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21zM12 8.2a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 0 0 0-4.6z" />,
  },
  {
    href: '/congresso',
    rotulo: 'Congresso',
    tambem: ['/votacao'],
    icone: <path d="M3 20h18M5 20v-8M9.5 20v-8M14.5 20v-8M19 20v-8M3.5 12h17L12 4.5z" />,
  },
  {
    href: '/comparar',
    rotulo: 'Comparar',
    tambem: [],
    icone: <path d="M4 5h6v14H4zM14 5h6v14h-6zM6.5 9h1M6.5 12.5h1M16.5 9h1M16.5 12.5h1" />,
  },
  {
    href: '/cargos',
    rotulo: 'Cargos',
    tambem: [],
    icone: <path d="M5 4.5h10.5A3.5 3.5 0 0 1 19 8v11.5H8.5A3.5 3.5 0 0 1 5 16zM5 16a3.5 3.5 0 0 1 3.5-3.5H19M9 8h6" />,
  },
  {
    href: '/sobre',
    rotulo: 'Sobre',
    tambem: [],
    icone: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5.5M12 7.6v.1" />,
  },
] as const;

function estaNaAba(caminho: string, aba: (typeof ABAS)[number]): boolean {
  if (aba.href === '/') return caminho === '/' || aba.tambem.some((p) => caminho.startsWith(p));
  return [aba.href, ...aba.tambem].some((p) => caminho === p || caminho.startsWith(`${p}/`));
}

/** Navegação principal: barra fixa embaixo no celular, links no topo em telas largas. */
export function Abas() {
  const caminho = usePathname();
  return (
    <nav className="abas" aria-label="Seções do site">
      <ul>
        {ABAS.map((aba) => (
          <li key={aba.href}>
            <Link href={aba.href} aria-current={estaNaAba(caminho, aba) ? 'page' : undefined}>
              <Icone>{aba.icone}</Icone>
              <span>{aba.rotulo}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
