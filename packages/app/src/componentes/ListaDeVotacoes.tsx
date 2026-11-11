import Link from 'next/link';
import type { Votacao } from '@/fontes/modelo';
import { caminhoDaVotacao, formatarData, formatarPlacar, tituloDaVotacao } from '@/apresentacao/formatos';
import { ROTULO_CASA, ROTULO_RESULTADO } from '@/apresentacao/rotulos';

/** Votações agrupadas por dia, na ordem recebida (mais recentes primeiro). */
export function ListaDeVotacoes({ votacoes }: { votacoes: readonly Votacao[] }) {
  const dias: { data: string; itens: Votacao[] }[] = [];
  for (const v of votacoes) {
    const ultimo = dias.at(-1);
    if (ultimo?.data === v.data) ultimo.itens.push(v);
    else dias.push({ data: v.data, itens: [v] });
  }

  return (
    <div className="pauta">
      {dias.map(({ data, itens }) => (
        <section key={data} aria-labelledby={`dia-${data}`}>
          <h2 id={`dia-${data}`}>
            <time dateTime={data}>{formatarData(data)}</time>
          </h2>
          <ul>
            {itens.map((v) => (
              <li key={v.id}>
                <span className="pauta-casa">{ROTULO_CASA[v.casa]}</span>
                <Link href={caminhoDaVotacao(v)} className="pauta-titulo">
                  {tituloDaVotacao(v)}
                </Link>
                {v.proposicao?.ementa ? <p>{v.proposicao.ementa}</p> : null}
                <p className="pauta-resultado">
                  {ROTULO_RESULTADO[v.resultado]}
                  {v.placar ? `: ${formatarPlacar(v.placar)}` : null}
                  {v.secreta ? ' (votação secreta)' : null}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
