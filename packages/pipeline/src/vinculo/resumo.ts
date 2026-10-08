import type { CargoTse, CandidatoTse } from '../tse/candidatos.js';
import { eleito, type ResultadoVinculo } from './casar.js';

export const FONTES_VINCULO = 'Fontes: TSE (candidatos 2026, CC-BY), Câmara dos Deputados e Senado Federal — Dados Abertos';

const CASA_DO_CARGO: Record<CargoTse, 'camara' | 'senado'> = { deputado_federal: 'camara', senador: 'senado' };
const NOME_CARGO: Record<CargoTse, string> = { deputado_federal: 'Deputado federal', senador: 'Senador' };
const MOTIVO: Record<string, string> = {
  nome_civil_ambiguo: 'nome civil igual, mais de um par',
  nome_urna_uf: 'nome de urna = nome parlamentar, mesma UF',
  nome_civil_outra_uf: 'nome civil igual, outra UF',
};

export interface ContagemCargo {
  eleitos: number;
  naCasaDoCargo: number;
  soNaOutraCasa: number;
  semVinculo: number;
  comSugestao: number;
}

export function contarPorCargo(candidatos: readonly CandidatoTse[], r: ResultadoVinculo): Record<CargoTse, ContagemCargo> {
  const casasPorSq = new Map<string, Set<string>>();
  for (const v of r.vinculos) casasPorSq.set(v.sqCandidato, (casasPorSq.get(v.sqCandidato) ?? new Set()).add(v.casa));
  const comSugestao = new Set(r.sugestoes.map((s) => s.sqCandidato));
  const vazio = (): ContagemCargo => ({ eleitos: 0, naCasaDoCargo: 0, soNaOutraCasa: 0, semVinculo: 0, comSugestao: 0 });
  const total = { deputado_federal: vazio(), senador: vazio() };
  for (const c of candidatos) {
    if (!eleito(c)) continue;
    const t = total[c.cargo];
    t.eleitos += 1;
    const casas = casasPorSq.get(c.sqCandidato);
    if (casas?.has(CASA_DO_CARGO[c.cargo])) t.naCasaDoCargo += 1;
    else if (casas?.size) t.soNaOutraCasa += 1;
    else t.semVinculo += 1;
    if (comSugestao.has(c.sqCandidato)) t.comSugestao += 1;
  }
  return total;
}

/** Eleitos sem nenhum vínculo (para o JSON de saída; em geral, novatos sem id nas casas). */
export function eleitosSemVinculo(candidatos: readonly CandidatoTse[], r: ResultadoVinculo) {
  const comVinculo = new Set(r.vinculos.map((v) => v.sqCandidato));
  return candidatos
    .filter((c) => eleito(c) && !comVinculo.has(c.sqCandidato))
    .map((c) => ({ sqCandidato: c.sqCandidato, cargo: c.cargo, uf: c.uf, nomeUrna: c.nomeUrna, partido: c.partido }));
}

export function resumoVinculos(candidatos: readonly CandidatoTse[], r: ResultadoVinculo, maxSugestoes = 40): string {
  const porCargo = contarPorCargo(candidatos, r);
  const linhas = ['## Vínculo TSE ↔ Câmara/Senado', ''];
  linhas.push(
    '| Cargo | Eleitos | Com id na casa do cargo | Só na outra casa | Sem id (novatos) | Com sugestão para revisar |',
    '|---|---|---|---|---|---|',
  );
  for (const cargo of ['deputado_federal', 'senador'] as const) {
    const t = porCargo[cargo];
    linhas.push(`| ${NOME_CARGO[cargo]} | ${t.eleitos} | ${t.naCasaDoCargo} | ${t.soNaOutraCasa} | ${t.semVinculo} | ${t.comSugestao} |`);
  }
  const manuais = r.vinculos.filter((v) => v.metodo === 'manual').length;
  linhas.push('', `Vínculos gravados (todos os candidatos, inclusive não eleitos): ${r.vinculos.length} — ${manuais} manuais.`, '');
  linhas.push('"Só na outra casa": ex.: deputado eleito senador — o id do Senado vem depois da posse.', '');

  if (r.sugestoes.length > 0) {
    linhas.push(`### Sugestões para revisar (${r.sugestoes.length})`, '', '| Candidato (TSE) | Parlamentar | Motivo | SQ |', '|---|---|---|---|');
    for (const s of r.sugestoes.slice(0, maxSugestoes)) {
      linhas.push(`| ${s.candidato} | ${s.parlamentar} | ${MOTIVO[s.motivo] ?? s.motivo} | ${s.sqCandidato} |`);
    }
    if (r.sugestoes.length > maxSugestoes) linhas.push(`| … e mais ${r.sugestoes.length - maxSugestoes} no arquivo | | | |`);
    linhas.push(
      '',
      'Para confirmar ou recusar, acrescente em `packages/pipeline/vinculos-manuais.json` (via pull request): ' +
        '`{ "sqCandidato": "…", "parlamentarId": "camara:…", "acao": "vincular" | "bloquear", "nota": "…" }`.',
      '',
    );
  }
  if (r.manuaisSemCandidato.length > 0) {
    linhas.push(`Ajustes manuais sem candidato no arquivo do TSE: ${r.manuaisSemCandidato.join(', ')}`, '');
  }
  linhas.push(`_${FONTES_VINCULO}._`, '');
  return linhas.join('\n');
}
