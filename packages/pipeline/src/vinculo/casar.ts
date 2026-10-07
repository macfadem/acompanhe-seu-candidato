/**
 * Vínculo candidato do TSE ↔ parlamentar da Câmara/Senado.
 *
 * Regra automática (única que grava sozinha): nome civil igual — sem acento, pontuação ou
 * caixa — e mesma UF, com par único dos dois lados. O resto vira sugestão para revisão
 * humana (só para eleitos) e entra pelo arquivo vinculos-manuais.json, revisado em PR.
 * Não usa CPF nem data de nascimento.
 */
import { z } from 'zod';
import { semAcentos } from '../texto.js';
import type { Casa } from '../tipos.js';
import type { CandidatoTse } from '../tse/candidatos.js';
import type { ParlamentarLista } from './listas.js';

export type MetodoVinculo = 'nome_civil_uf' | 'manual';
export type MotivoSugestao = 'nome_civil_ambiguo' | 'nome_urna_uf' | 'nome_civil_outra_uf';

export interface Vinculo {
  sqCandidato: string;
  parlamentarId: string;
  casa: Casa;
  metodo: MetodoVinculo;
}

export interface Sugestao {
  sqCandidato: string;
  parlamentarId: string;
  motivo: MotivoSugestao;
  /** Rótulos públicos para a revisão: "NOME DE URNA (PARTIDO-UF), cargo" e "Nome (PARTIDO-UF), casa". */
  candidato: string;
  parlamentar: string;
}

export interface VinculoManual {
  sqCandidato: string;
  parlamentarId: string;
  acao: 'vincular' | 'bloquear';
  nota?: string | undefined;
}

/** Formato de vinculos-manuais.json (o CI valida o arquivo do repositório). */
export const ArquivoManuais = z.array(
  z.object({
    sqCandidato: z.string().regex(/^\d+$/),
    parlamentarId: z.string().regex(/^(camara|senado):\d+$/),
    acao: z.enum(['vincular', 'bloquear']),
    nota: z.string().optional(),
  }),
);

export interface ResultadoVinculo {
  vinculos: Vinculo[];
  sugestoes: Sugestao[];
  /** Ajustes manuais que não acharam o candidato no arquivo do TSE. */
  manuaisSemCandidato: string[];
}

/** "Acácio da Silva Favacho Neto" e "ACÁCIO DA SILVA FAVACHO NETO" → "ACACIO DA SILVA FAVACHO NETO". */
export function normalizarNome(nome: string): string {
  return semAcentos(nome)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

const ELEITO = new Set([1, 2, 3]);
export const eleito = (c: Pick<CandidatoTse, 'cdSituacaoTotalizacao'>) =>
  c.cdSituacaoTotalizacao !== null && ELEITO.has(c.cdSituacaoTotalizacao);

const CARGO = { deputado_federal: 'deputado federal', senador: 'senador' } as const;
const CASA = { camara: 'Câmara', senado: 'Senado' } as const;
const rotuloCandidato = (c: CandidatoTse) => `${c.nomeUrna} (${c.partido}-${c.uf}), ${CARGO[c.cargo]}`;
const rotuloParlamentar = (p: ParlamentarLista) => `${p.nome} (${p.partido ?? '?'}-${p.uf ?? '?'}), ${CASA[p.casa]} ${p.idCasa}`;

function indexar(lista: readonly ParlamentarLista[], chave: (p: ParlamentarLista) => string | null) {
  const indice = new Map<string, ParlamentarLista[]>();
  for (const p of lista) {
    const k = chave(p);
    if (k) indice.set(k, [...(indice.get(k) ?? []), p]);
  }
  return indice;
}

export function casar(
  candidatos: readonly CandidatoTse[],
  lista: readonly ParlamentarLista[],
  manuais: readonly VinculoManual[] = [],
): ResultadoVinculo {
  const porCivilUf = indexar(lista, (p) => (p.nomeCivil && p.uf ? `${p.casa}|${normalizarNome(p.nomeCivil)}|${p.uf}` : null));
  const porCivil = indexar(lista, (p) => (p.nomeCivil ? `${p.casa}|${normalizarNome(p.nomeCivil)}` : null));
  const porNomeUf = indexar(lista, (p) => (p.uf ? `${p.casa}|${normalizarNome(p.nome)}|${p.uf}` : null));
  const porId = new Map(lista.map((p) => [p.id, p]));

  const automaticos: Vinculo[] = [];
  const sugestoes: Sugestao[] = [];
  const sugerir = (c: CandidatoTse, ps: readonly ParlamentarLista[], motivo: MotivoSugestao) => {
    if (!eleito(c)) return; // revisão humana só onde importa
    for (const p of ps.slice(0, 3)) {
      sugestoes.push({ sqCandidato: c.sqCandidato, parlamentarId: p.id, motivo, candidato: rotuloCandidato(c), parlamentar: rotuloParlamentar(p) });
    }
  };

  for (const c of candidatos) {
    const civil = normalizarNome(c.nomeCivil);
    for (const casa of ['camara', 'senado'] as const) {
      const exatos = porCivilUf.get(`${casa}|${civil}|${c.uf}`) ?? [];
      if (exatos.length === 1) {
        automaticos.push({ sqCandidato: c.sqCandidato, parlamentarId: exatos[0]!.id, casa, metodo: 'nome_civil_uf' });
        continue;
      }
      if (exatos.length > 1) {
        sugerir(c, exatos, 'nome_civil_ambiguo');
        continue;
      }
      const porUrna = porNomeUf.get(`${casa}|${normalizarNome(c.nomeUrna)}|${c.uf}`) ?? [];
      if (porUrna.length > 0) {
        sugerir(c, porUrna, 'nome_urna_uf');
        continue;
      }
      const outraUf = porCivil.get(`${casa}|${civil}`) ?? [];
      if (outraUf.length > 0) sugerir(c, outraUf, 'nome_civil_outra_uf');
    }
  }

  // Um parlamentar ligado a dois candidatos é homônimo: nenhum dos dois vale sozinho.
  const contagem = new Map<string, number>();
  for (const v of automaticos) contagem.set(v.parlamentarId, (contagem.get(v.parlamentarId) ?? 0) + 1);
  const porSq = new Map(candidatos.map((c) => [c.sqCandidato, c]));
  const unicos = automaticos.filter((v) => {
    if (contagem.get(v.parlamentarId) === 1) return true;
    const c = porSq.get(v.sqCandidato);
    const p = porId.get(v.parlamentarId);
    if (c && p) sugerir(c, [p], 'nome_civil_ambiguo');
    return false;
  });

  // Ajustes manuais (revisados em PR) valem sobre a regra automática.
  const chave = (sq: string, id: string) => `${sq}|${id}`;
  const bloqueados = new Set(manuais.filter((m) => m.acao === 'bloquear').map((m) => chave(m.sqCandidato, m.parlamentarId)));
  const manuaisSemCandidato = manuais.filter((m) => !porSq.has(m.sqCandidato)).map((m) => m.sqCandidato);
  const vinculos = new Map<string, Vinculo>();
  for (const v of unicos) if (!bloqueados.has(chave(v.sqCandidato, v.parlamentarId))) vinculos.set(chave(v.sqCandidato, v.parlamentarId), v);
  for (const m of manuais) {
    if (m.acao !== 'vincular' || !porSq.has(m.sqCandidato)) continue;
    const casa = m.parlamentarId.startsWith('senado:') ? 'senado' : 'camara';
    vinculos.set(chave(m.sqCandidato, m.parlamentarId), { sqCandidato: m.sqCandidato, parlamentarId: m.parlamentarId, casa, metodo: 'manual' });
  }
  const resolvidos = new Set([...bloqueados, ...vinculos.keys()]);
  // Candidato com qualquer ajuste manual já foi revisado: as sugestões dele saem da lista.
  const sqResolvidos = new Set(manuais.map((m) => m.sqCandidato));

  return {
    vinculos: [...vinculos.values()].sort((a, b) => a.sqCandidato.localeCompare(b.sqCandidato) || a.parlamentarId.localeCompare(b.parlamentarId)),
    sugestoes: sugestoes.filter((s) => !resolvidos.has(chave(s.sqCandidato, s.parlamentarId)) && !sqResolvidos.has(s.sqCandidato)),
    manuaisSemCandidato,
  };
}
