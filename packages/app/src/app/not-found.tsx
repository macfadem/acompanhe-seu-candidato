import Link from 'next/link';

export default function NaoEncontrado() {
  return (
    <section className="abertura">
      <h1>Página não encontrada</h1>
      <p>O endereço pode estar errado, ou este parlamentar ainda não aparece nas votações coletadas.</p>
      <p>
        <Link href="/">Ver todos os parlamentares</Link>
      </p>
    </section>
  );
}
