import Link from 'next/link';
import type { RegistroNaVotacao } from '@/fontes/modelo';
import { caminhoDaVotacao, formatarData, formatarMes, tituloDaVotacao } from '@/apresentacao/formatos';
import { agruparPorMes, grupoDoRegistro, ROTULO_GRUPO, type GrupoDoRegistro } from '@/apresentacao/registros';
import { ROTULO_VOTO } from '@/apresentacao/rotulos';

const ORDEM: readonly GrupoDoRegistro[] = ['voto', 'ausencia', 'outro', 'sem_registro'];

/**
 * Um quadrado por votação nominal da casa, da mais antiga para a mais recente. O preenchimento
 * diz só o tipo de registro (nunca sim ou não); cada quadrado leva à votação.
 */
export function GradeDeRegistros({ registros }: { registros: readonly RegistroNaVotacao[] }) {
  if (registros.length === 0) return null;
  const presentes = ORDEM.filter((g) => registros.some((r) => grupoDoRegistro(r.voto) === g));

  return (
    <div className="grade">
      {agruparPorMes(registros).map(({ mes, itens }) => (
        <div key={mes} className="grade-mes">
          <h3>{formatarMes(mes)}</h3>
          <ul>
            {itens.map(({ votacao, voto }) => (
              <li key={votacao.id}>
                <Link
                  href={caminhoDaVotacao(votacao)}
                  className={`quadrado quadrado-${grupoDoRegistro(voto)}`}
                  aria-label={`${formatarData(votacao.data)}, ${tituloDaVotacao(votacao)}: ${voto ? ROTULO_VOTO[voto.categoria] : ROTULO_GRUPO.sem_registro}`}
                  title={`${formatarData(votacao.data)}: ${voto ? ROTULO_VOTO[voto.categoria] : ROTULO_GRUPO.sem_registro}`}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
      <ul className="grade-legenda">
        {presentes.map((g) => (
          <li key={g}>
            <span className={`quadrado quadrado-${g}`} aria-hidden="true" />
            {ROTULO_GRUPO[g]}
          </li>
        ))}
      </ul>
    </div>
  );
}
