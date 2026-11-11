import { CATEGORIAS_VOTO } from '@acompanhe/pipeline/tipos';
import { EXPLICACAO_VOTO, ROTULO_VOTO } from '@/apresentacao/rotulos';

/** O que cada registro quer dizer, na ordem do modelo de dados. Igual em todas as páginas. */
export function Legenda() {
  return (
    <details className="legenda">
      <summary>O que significa cada registro</summary>
      <dl>
        {CATEGORIAS_VOTO.map((categoria) => (
          <div key={categoria}>
            <dt>{ROTULO_VOTO[categoria]}</dt>
            <dd>{EXPLICACAO_VOTO[categoria]}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
