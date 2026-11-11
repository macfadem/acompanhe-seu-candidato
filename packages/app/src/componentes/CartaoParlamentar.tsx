import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Parlamentar } from '@/fontes/modelo';
import { caminhoDeComparar, caminhoDoParlamentar, iniciais, partidoUf } from '@/apresentacao/formatos';

/** As iniciais no lugar da foto: o site não usa imagens de pessoas. */
export function Monograma({ nome, grande = false }: { nome: string; grande?: boolean }) {
  return (
    <span className={grande ? 'monograma monograma-grande' : 'monograma'} aria-hidden="true">
      {iniciais(nome)}
    </span>
  );
}

interface Props {
  parlamentar: Parlamentar;
  /** O que aparece à direita; por padrão, o link "Comparar". */
  acao?: ReactNode;
}

export function CartaoParlamentar({ parlamentar, acao }: Props) {
  return (
    <li className="cartao">
      <Monograma nome={parlamentar.nome} />
      <span className="cartao-texto">
        <Link href={caminhoDoParlamentar(parlamentar)} className="cartao-nome">
          {parlamentar.nome}
        </Link>
        <span className="cartao-detalhe">
          {parlamentar.casa === 'camara' ? 'Deputado(a) federal' : 'Senador(a)'}, {partidoUf(parlamentar.partido, parlamentar.uf)}
        </span>
      </span>
      {acao ?? (
        <Link href={caminhoDeComparar([parlamentar.id])} className="botao-leve" aria-label={`Comparar ${parlamentar.nome}`}>
          Comparar
        </Link>
      )}
    </li>
  );
}
