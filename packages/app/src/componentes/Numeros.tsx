import { CATEGORIAS_VOTO } from '@acompanhe/pipeline/tipos';
import { ROTULO_VOTO } from '@/apresentacao/rotulos';
import type { Resumo } from '@/apresentacao/registros';

/** Os números do período: só contagens do que a fonte registra, na ordem do modelo de dados. */
export function Numeros({ resumo }: { resumo: Resumo }) {
  const categorias = CATEGORIAS_VOTO.filter((c) => resumo.porCategoria[c] > 0);
  return (
    <dl className="numeros">
      <div className="numero numero-largo">
        <dd>
          {resumo.comRegistro} <span>de {resumo.votacoes}</span>
        </dd>
        <dt>votações nominais da casa com registro deste parlamentar</dt>
      </div>
      {categorias.map((c) => (
        <div key={c} className="numero">
          <dd>{resumo.porCategoria[c]}</dd>
          <dt>{ROTULO_VOTO[c]}</dt>
        </div>
      ))}
    </dl>
  );
}
