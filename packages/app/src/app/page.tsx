import Link from 'next/link';
import { fonteDeDados } from '@/fontes/escolher';
import { CASAS } from '@/fontes/modelo';
import { ROTULO_CASA } from '@/apresentacao/rotulos';
import { caminhoDoParlamentar, partidoUf } from '@/apresentacao/formatos';

export default async function Inicio() {
  const parlamentares = await fonteDeDados().listarParlamentares();

  return (
    <>
      <section className="abertura" aria-labelledby="titulo-inicio">
        <h1 id="titulo-inicio">Como votam deputados e senadores</h1>
        <p>
          Cada registro vem das votações nominais de plenário da Câmara e do Senado e leva para a fonte oficial. Os
          mesmos campos e o mesmo tom para todos os parlamentares.
        </p>
      </section>

      {parlamentares.length === 0 ? <p>Nenhum parlamentar nos dados carregados.</p> : null}

      {CASAS.map((casa) => {
        const daCasa = parlamentares.filter((p) => p.casa === casa);
        if (daCasa.length === 0) return null;
        return (
          <section key={casa} className="chamada" aria-labelledby={`casa-${casa}`}>
            <h2 id={`casa-${casa}`}>{ROTULO_CASA[casa]}</h2>
            <p className="contagem">
              {daCasa.length === 1 ? '1 parlamentar' : `${daCasa.length} parlamentares`} com votos nos dados
              carregados.
            </p>
            <ul className="nomes">
              {daCasa.map((p) => (
                <li key={p.id}>
                  <Link href={caminhoDoParlamentar(p)}>{p.nome}</Link>
                  <span className="sigla">{partidoUf(p.partido, p.uf)}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
