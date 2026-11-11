/** As 27 unidades da federação, em ordem alfabética da sigla. */
export const UFS = [
  ['AC', 'Acre'],
  ['AL', 'Alagoas'],
  ['AM', 'Amazonas'],
  ['AP', 'Amapá'],
  ['BA', 'Bahia'],
  ['CE', 'Ceará'],
  ['DF', 'Distrito Federal'],
  ['ES', 'Espírito Santo'],
  ['GO', 'Goiás'],
  ['MA', 'Maranhão'],
  ['MG', 'Minas Gerais'],
  ['MS', 'Mato Grosso do Sul'],
  ['MT', 'Mato Grosso'],
  ['PA', 'Pará'],
  ['PB', 'Paraíba'],
  ['PE', 'Pernambuco'],
  ['PI', 'Piauí'],
  ['PR', 'Paraná'],
  ['RJ', 'Rio de Janeiro'],
  ['RN', 'Rio Grande do Norte'],
  ['RO', 'Rondônia'],
  ['RR', 'Roraima'],
  ['RS', 'Rio Grande do Sul'],
  ['SC', 'Santa Catarina'],
  ['SE', 'Sergipe'],
  ['SP', 'São Paulo'],
  ['TO', 'Tocantins'],
] as const;

export type SiglaUf = (typeof UFS)[number][0];

const NOMES = new Map<string, string>(UFS);

/** Nome da UF pela sigla, em qualquer caixa ("mg" → "Minas Gerais"); `null` se não existir. */
export function nomeDaUf(sigla: string): string | null {
  return NOMES.get(sigla.toUpperCase()) ?? null;
}

export function ehUf(sigla: string): sigla is SiglaUf {
  return NOMES.has(sigla);
}
