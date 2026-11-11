interface Props {
  acao: string;
  valor?: string;
  rotulo: string;
  /** Campos escondidos que acompanham a busca (por exemplo, quem já está na comparação). */
  manter?: readonly { nome: string; valor: string }[];
}

/** Formulário GET: a busca funciona sem JavaScript e o resultado tem endereço próprio. */
export function Busca({ acao, valor = '', rotulo, manter = [] }: Props) {
  return (
    <form action={acao} method="get" role="search" className="busca">
      {manter.map((campo, i) => (
        <input key={`${campo.nome}-${i}`} type="hidden" name={campo.nome} value={campo.valor} />
      ))}
      <label htmlFor="campo-busca">{rotulo}</label>
      <div className="busca-linha">
        <input
          id="campo-busca"
          name="q"
          type="search"
          defaultValue={valor}
          placeholder="Nome, partido ou estado"
          autoComplete="off"
          enterKeyHint="search"
          minLength={2}
          required
        />
        <button type="submit">Buscar</button>
      </div>
    </form>
  );
}
