import Link from 'next/link';
import type { OrigemDosDados as Origem } from '@/fontes/modelo';
import { formatarData } from '@/apresentacao/formatos';

/** Aviso no topo quando os dados são os de exemplo: ninguém deve confundir com votos reais. */
export function AvisoDeExemplo({ origem }: { origem: Origem }) {
  if (origem.tipo !== 'exemplo') return null;
  return (
    <div className="aviso-exemplo" role="note">
      <p>
        <strong>Dados de exemplo.</strong> Nomes, partidos e votos são fictícios. <Link href="/sobre">Saiba mais</Link>
      </p>
    </div>
  );
}

/** Linha do rodapé que diz de qual coleta vieram os dados. */
export function PeriodoDaColeta({ origem }: { origem: Origem }) {
  if (origem.tipo !== 'arquivo' || origem.intervalo === null) return null;
  return (
    <p>
      Votações coletadas de {formatarData(origem.intervalo.de)} a {formatarData(origem.intervalo.ate)}.
    </p>
  );
}
