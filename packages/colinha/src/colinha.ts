/**
 * A colinha: em quem a pessoa votou. É dado sensível (LGPD, art. 5º, II) e só existe
 * no aparelho dela. Guarda apenas o código do candidato no TSE (SQ_CANDIDATO); nome,
 * foto e partido vêm dos dados públicos.
 */
import { z } from 'zod';

export const ELEICAO = 2026;

/** Quantos candidatos cabem por cargo (2026: um deputado federal e dois senadores). */
export const LIMITES = { deputado_federal: 1, senador: 2 } as const;
export type Cargo = keyof typeof LIMITES;
const CARGOS = Object.keys(LIMITES) as [Cargo, ...Cargo[]];

export const ItemSchema = z.object({
  cargo: z.enum(CARGOS),
  /** SQ_CANDIDATO do TSE. */
  sq: z.string().regex(/^\d{1,20}$/, 'código de candidato inválido'),
});
export type Item = z.infer<typeof ItemSchema>;

export const ColinhaSchema = z
  .object({
    v: z.literal(1),
    eleicao: z.literal(ELEICAO),
    /** UF do eleitor: decide qual pacote de resumos o app baixa. */
    uf: z.string().regex(/^[A-Z]{2}$/, 'UF inválida').nullable(),
    itens: z.array(ItemSchema).max(3),
  })
  .superRefine((colinha, ctx) => {
    for (const cargo of CARGOS) {
      const n = colinha.itens.filter((i) => i.cargo === cargo).length;
      if (n > LIMITES[cargo]) ctx.addIssue({ code: 'custom', message: `mais de ${LIMITES[cargo]} para ${cargo}` });
    }
    const sqs = colinha.itens.map((i) => i.sq);
    if (new Set(sqs).size !== sqs.length) ctx.addIssue({ code: 'custom', message: 'candidato repetido' });
  });
export type Colinha = z.infer<typeof ColinhaSchema>;

export type Resultado<T> = { ok: true; valor: T } | { ok: false; erro: string };

export const sucesso = <T>(valor: T): Resultado<T> => ({ ok: true, valor });
export const falha = <T>(erro: string): Resultado<T> => ({ ok: false, erro });

export function novaColinha(uf: string | null = null): Colinha {
  return { v: 1, eleicao: ELEICAO, uf, itens: [] };
}

/** Valida algo que veio de fora (armazenamento, link, arquivo) sem nunca lançar erro. */
export function validarColinha(dado: unknown): Resultado<Colinha> {
  const r = ColinhaSchema.safeParse(dado);
  return r.success ? sucesso(r.data) : falha(r.error.issues[0]?.message ?? 'colinha inválida');
}

/**
 * Escolhe um candidato. Deputado federal substitui o anterior; senador entra até 2.
 * Nunca altera o objeto recebido.
 */
export function escolher(colinha: Colinha, item: Item): Resultado<Colinha> {
  const valido = ItemSchema.safeParse(item);
  if (!valido.success) return falha(valido.error.issues[0]?.message ?? 'candidato inválido');
  if (colinha.itens.some((i) => i.sq === item.sq)) return sucesso(colinha);

  let itens = [...colinha.itens];
  const mesmoCargo = itens.filter((i) => i.cargo === item.cargo);
  if (mesmoCargo.length >= LIMITES[item.cargo]) {
    if (LIMITES[item.cargo] > 1) {
      return falha(`Já há ${LIMITES[item.cargo]} escolhidos para ${item.cargo}: remova um antes.`);
    }
    itens = itens.filter((i) => i.cargo !== item.cargo);
  }
  return validarColinha({ ...colinha, itens: [...itens, { cargo: item.cargo, sq: item.sq }] });
}

export function remover(colinha: Colinha, sq: string): Colinha {
  return { ...colinha, itens: colinha.itens.filter((i) => i.sq !== sq) };
}

export function definirUf(colinha: Colinha, uf: string | null): Resultado<Colinha> {
  return validarColinha({ ...colinha, uf });
}

/** Mesmo conteúdo (ignora a ordem dos itens). */
export function mesmaColinha(a: Colinha, b: Colinha): boolean {
  const chave = (c: Colinha) =>
    JSON.stringify([c.uf, c.itens.map((i) => `${i.cargo}:${i.sq}`).sort()]);
  return chave(a) === chave(b);
}
