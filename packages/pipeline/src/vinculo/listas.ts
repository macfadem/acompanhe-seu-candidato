/**
 * Listas oficiais de parlamentares para o vínculo com os candidatos do TSE.
 *
 * - Câmara: `/deputados?idLegislatura=N` (id, nome, partido, UF) das legislaturas pedidas
 *   + o arquivo deputados.csv, só para o nome civil. O CSV também traz CPF, data de
 *   nascimento e outros dados pessoais: só as colunas `uri` e `nomeCivil` são lidas.
 * - Senado: `/senador/lista/atual` (senadores em exercício).
 *
 * Só dados públicos. Lista menor que o mínimo esperado é erro: um vínculo nunca é
 * apagado por causa de uma resposta incompleta.
 */
import { z } from 'zod';
import { type ClienteHttp, type ClienteHttpTexto, ErroHttp } from '../http.js';
import { linhasCsv } from '../tse/csv.js';
import type { Casa } from '../tipos.js';
import { ErroFormato, validar } from '../validar.js';

export const CAMARA_API = 'https://dadosabertos.camara.leg.br/api/v2';
export const CAMARA_CSV_DEPUTADOS = 'https://dadosabertos.camara.leg.br/arquivos/deputados/csv/deputados.csv';
export const SENADO_LISTA_ATUAL = 'https://legis.senado.leg.br/dadosabertos/senador/lista/atual';

export interface ParlamentarLista {
  /** "camara:204480" ou "senado:5672" — o mesmo id da tabela parlamentar. */
  id: string;
  casa: Casa;
  idCasa: string;
  /** Nome parlamentar (como aparece nas votações). */
  nome: string;
  nomeCivil: string | null;
  uf: string | null;
  partido: string | null;
  /** Legislatura mais recente em que aparece (Câmara) ou "atual" (Senado em exercício). */
  referencia: string;
}

const PaginaDeputados = z.object({
  dados: z.array(
    z.object({
      id: z.number().int(),
      nome: z.string(),
      siglaPartido: z.string().nullish(),
      siglaUf: z.string().nullish(),
      idLegislatura: z.number().int(),
    }),
  ),
  links: z.array(z.object({ rel: z.string(), href: z.string() })).default([]),
});

/**
 * Deputados das legislaturas pedidas (da mais recente para a mais antiga), sem repetir id.
 * A 58ª (2027–2031) entra assim que a Câmara cadastrar os eleitos: até lá vem vazia (ou com
 * erro 4xx, que é ignorado só para legislaturas futuras). A atual tem de vir completa.
 */
export async function listaCamara(
  cliente: ClienteHttpTexto,
  opcoes: { legislaturas?: number[]; atual?: number; minimoNaAtual?: number } = {},
): Promise<ParlamentarLista[]> {
  const legislaturas = [...(opcoes.legislaturas ?? [58, 57, 56, 55])].sort((a, b) => b - a);
  const atual = opcoes.atual ?? 57;
  const minimo = opcoes.minimoNaAtual ?? 513;
  const porId = new Map<string, ParlamentarLista>();

  for (const legislatura of legislaturas) {
    let url: string | undefined =
      `${CAMARA_API}/deputados?idLegislatura=${legislatura}&itens=100&ordem=ASC&ordenarPor=nome`;
    const vistos = new Set<string>();
    for (let paginas = 0; url; paginas++) {
      if (paginas > 50) throw new ErroFormato(`Câmara: paginação sem fim em /deputados?idLegislatura=${legislatura}`);
      let bruto: unknown;
      try {
        bruto = await cliente.getJson(url);
      } catch (erro) {
        const futura = legislatura > atual && erro instanceof ErroHttp && erro.status >= 400 && erro.status < 500;
        if (futura) break; // ainda não existe na API
        throw erro;
      }
      const pagina: z.infer<typeof PaginaDeputados> = validar(PaginaDeputados, bruto, `Câmara /deputados (legislatura ${legislatura})`);
      for (const d of pagina.dados) {
        const idCasa = String(d.id);
        vistos.add(idCasa);
        if (porId.has(`camara:${idCasa}`)) continue; // fica a legislatura mais recente
        porId.set(`camara:${idCasa}`, {
          id: `camara:${idCasa}`,
          casa: 'camara',
          idCasa,
          nome: d.nome.trim(),
          nomeCivil: null,
          uf: d.siglaUf?.trim() || null,
          partido: d.siglaPartido?.trim() || null,
          referencia: String(d.idLegislatura),
        });
      }
      url = pagina.links.find((l) => l.rel === 'next')?.href;
    }
    if (legislatura === atual && vistos.size < minimo) {
      throw new ErroFormato(`Câmara: só ${vistos.size} deputados na legislatura ${legislatura} (esperado ≥ ${minimo}) — lista incompleta?`);
    }
  }

  const civis = nomesCivisCamara(await cliente.getTexto(CAMARA_CSV_DEPUTADOS));
  for (const p of porId.values()) p.nomeCivil = civis.get(p.idCasa) ?? null;
  return [...porId.values()];
}

/** Do deputados.csv lê só `uri` (para o id) e `nomeCivil`. As outras colunas são descartadas. */
export function nomesCivisCamara(csv: string): Map<string, string> {
  const linhas = linhasCsv(csv.replace(/^﻿/, ''));
  const primeira: IteratorResult<string[]> = linhas.next();
  const cabecalho = primeira.done ? [] : primeira.value.map((c) => c.trim());
  const iUri = cabecalho.indexOf('uri');
  const iCivil = cabecalho.indexOf('nomeCivil');
  if (iUri < 0 || iCivil < 0) throw new ErroFormato('Câmara deputados.csv sem as colunas "uri" e "nomeCivil".');
  const mapa = new Map<string, string>();
  for (const campos of linhas) {
    const id = /\/deputados\/(\d+)$/.exec(campos[iUri]?.trim() ?? '')?.[1];
    const civil = campos[iCivil]?.trim();
    if (id && civil) mapa.set(id, civil);
  }
  return mapa;
}

const IdentificacaoSenador = z.object({
  CodigoParlamentar: z.string().regex(/^\d+$/),
  NomeParlamentar: z.string(),
  NomeCompletoParlamentar: z.string().nullish(),
  SiglaPartidoParlamentar: z.string().nullish(),
  UfParlamentar: z.string().nullish(),
});
const ItemSenador = z.object({ IdentificacaoParlamentar: IdentificacaoSenador });
/** A conversão XML→JSON do Senado devolve objeto (não lista) quando há um item só. */
const umOuVarios = <T extends z.ZodType>(item: T) => z.union([z.array(item), item.transform((x) => [x])]);
const ListaSenado = z.object({
  ListaParlamentarEmExercicio: z.object({
    Parlamentares: z.object({ Parlamentar: umOuVarios(ItemSenador) }),
  }),
});

export async function listaSenado(cliente: ClienteHttp, opcoes: { minimo?: number } = {}): Promise<ParlamentarLista[]> {
  const resposta = validar(ListaSenado, await cliente.getJson(SENADO_LISTA_ATUAL), 'Senado /senador/lista/atual');
  const itens = resposta.ListaParlamentarEmExercicio.Parlamentares.Parlamentar as Array<z.infer<typeof ItemSenador>>;
  const minimo = opcoes.minimo ?? 81;
  if (itens.length < minimo) throw new ErroFormato(`Senado: só ${itens.length} senadores em exercício (esperado ${minimo}) — lista incompleta?`);
  return itens.map(({ IdentificacaoParlamentar: s }) => ({
    id: `senado:${s.CodigoParlamentar}`,
    casa: 'senado' as const,
    idCasa: s.CodigoParlamentar,
    nome: s.NomeParlamentar.trim(),
    nomeCivil: s.NomeCompletoParlamentar?.trim() || null,
    uf: s.UfParlamentar?.trim() || null,
    partido: s.SiglaPartidoParlamentar?.trim() || null,
    referencia: 'atual',
  }));
}
