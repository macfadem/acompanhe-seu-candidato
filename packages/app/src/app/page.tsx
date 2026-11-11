import Link from 'next/link';
import { fonteDeDados } from '@/fontes/escolher';
import { UFS } from '@/apresentacao/ufs';
import { caminhoDaUf, plural } from '@/apresentacao/formatos';
import { Busca } from '@/componentes/Busca';

const PASSOS = [
  ['Escolha o estado', 'Toque na sigla ou busque pelo nome de um parlamentar.'],
  ['Veja quem representa', 'Os deputados federais e os senadores daquela UF.'],
  ['Abra o crachá', 'Os votos de plenário, um por um, com o link da fonte oficial.'],
] as const;

export default async function Inicio() {
  const parlamentares = await fonteDeDados().listarParlamentares();
  const porUf = new Map<string, number>();
  for (const p of parlamentares) if (p.uf) porUf.set(p.uf, (porUf.get(p.uf) ?? 0) + 1);

  return (
    <>
      <section className="abertura" aria-labelledby="titulo-inicio">
        <h1 id="titulo-inicio">Veja como vota quem representa você em Brasília</h1>
        <p>
          Deputados federais e senadores, voto a voto, nas votações nominais de plenário. O site mostra o registro
          oficial e o link da fonte. Não dá nota nem faz ranking.
        </p>
      </section>

      <Busca acao="/busca" rotulo="Buscar parlamentar" />

      <ol className="passos" aria-label="Como usar">
        {PASSOS.map(([titulo, texto]) => (
          <li key={titulo}>
            <strong>{titulo}</strong>
            <span>{texto}</span>
          </li>
        ))}
      </ol>

      <section className="secao" aria-labelledby="titulo-ufs">
        <h2 id="titulo-ufs">Escolha o estado</h2>
        <ul className="ufs">
          {UFS.map(([sigla, nome]) => {
            const n = porUf.get(sigla) ?? 0;
            return (
              <li key={sigla}>
                <Link href={caminhoDaUf(sigla)}>
                  <strong>{sigla}</strong>
                  <span className="uf-nome">{nome}</span>
                  <span className="uf-contagem">{n === 0 ? 'Sem registros' : plural(n, 'parlamentar', 'parlamentares')}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="adiante">
        <Link href="/congresso">Ver as votações mais recentes do Congresso</Link>
      </p>
    </>
  );
}
