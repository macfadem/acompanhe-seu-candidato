/**
 * Saídas da coleta para pessoas: resumo no terminal, lista de avisos, anotações do
 * GitHub Actions e resumo da execução em Markdown. Tudo aqui é dado público.
 */
import type { Aviso, Casa, Coleta, TipoAviso } from './tipos.js';

/** Ordem de revisão: primeiro o que exige mudar o código, depois o que pede conferência. */
const PRIORIDADE: Record<TipoAviso, number> = {
  formato_inesperado: 0,
  codigo_voto_desconhecido: 1,
  placar_divergente: 2,
  falha_coleta: 3,
  votos_indisponiveis: 4,
  proposicao_nao_identificada: 5,
  voto_duplicado: 6,
  orgao_nao_informado: 7,
};

const NOME_CASA: Record<Casa, string> = { camara: 'Câmara', senado: 'Senado' };

export function ordenarAvisos(avisos: readonly Aviso[]): Aviso[] {
  return [...avisos].sort(
    (a, b) => PRIORIDADE[a.tipo] - PRIORIDADE[b.tipo] || a.votacaoId.localeCompare(b.votacaoId),
  );
}

export function avisosPorTipo(avisos: readonly Aviso[]): Map<TipoAviso, number> {
  const porTipo = new Map<TipoAviso, number>();
  for (const a of ordenarAvisos(avisos)) porTipo.set(a.tipo, (porTipo.get(a.tipo) ?? 0) + 1);
  return porTipo;
}

function contagemPorCasa(coleta: Coleta, casa: Casa) {
  const vs = coleta.votacoes.filter((v) => v.casa === casa);
  const nominais = vs.filter((v) => v.nominal).length;
  return { total: vs.length, nominais, semVoto: vs.length - nominais };
}

/** Resumo curto para o terminal. */
export function resumoTexto(coleta: Coleta): string {
  const linhas: string[] = [];
  for (const casa of ['camara', 'senado'] as const) {
    const c = contagemPorCasa(coleta, casa);
    if (c.total > 0) linhas.push(`${casa}: ${c.total} votações de plenário (${c.nominais} nominais, ${c.semVoto} sem voto individual)`);
  }
  linhas.push(`votos: ${coleta.votos.length} · parlamentares: ${coleta.parlamentares.length}`);
  const porTipo = avisosPorTipo(coleta.avisos);
  linhas.push(
    porTipo.size === 0 ? 'avisos: nenhum' : `avisos: ${[...porTipo].map(([tipo, n]) => `${tipo}=${n}`).join(', ')}`,
  );
  return linhas.join('\n');
}

/** Lista dos avisos para conferir no terminal (o arquivo tem todos). */
export function detalhesAvisos(avisos: readonly Aviso[], maximo = 15): string {
  const ordenados = ordenarAvisos(avisos);
  const linhas = ordenados.slice(0, maximo).map((a) => {
    const [primeira, ...resto] = a.detalhe.split('\n');
    return [`- ${a.tipo} · ${a.votacaoId}: ${primeira}`, ...resto.map((r) => `    ${r}`)].join('\n');
  });
  if (ordenados.length > maximo) linhas.push(`- … e mais ${ordenados.length - maximo} no arquivo`);
  return linhas.join('\n');
}

// --- GitHub Actions ---

/** Escapes dos comandos de workflow (mesmas regras do @actions/core). */
const escaparDado = (texto: string) => texto.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
const escaparPropriedade = (texto: string) => escaparDado(texto).replace(/:/g, '%3A').replace(/,/g, '%2C');

/**
 * Uma anotação por aviso, na ordem de revisão. O GitHub mostra até 10 avisos por passo,
 * então os primeiros `maximo` vão detalhados e o resto é contado numa anotação final.
 */
export function anotacoesGithub(avisos: readonly Aviso[], arquivo: string, maximo = 9): string[] {
  const ordenados = ordenarAvisos(avisos);
  const linhas = ordenados.slice(0, maximo).map((a) => {
    const nivel = a.tipo === 'formato_inesperado' ? 'error' : 'warning';
    return `::${nivel} title=${escaparPropriedade(`${a.tipo} · ${a.votacaoId}`)}::${escaparDado(a.detalhe)}`;
  });
  const resto = ordenados.length - maximo;
  if (resto > 0) {
    linhas.push(
      `::warning title=${escaparPropriedade('Coleta de votações')}::${escaparDado(
        `mais ${resto} aviso(s) — lista completa no resumo da execução e em ${arquivo}`,
      )}`,
    );
  }
  return linhas;
}

const celula = (texto: string) =>
  texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>');

/** Resumo da execução (aparece na página do run no GitHub). */
export function resumoMarkdown(
  coleta: Coleta,
  meta: { de: string; ate: string; arquivo: string },
  maxLinhas = 100,
): string {
  const linhas = [`## Coleta de votações — ${meta.de} a ${meta.ate}`, ''];
  linhas.push('| Casa | Votações de plenário | Nominais | Sem voto individual |', '|---|---|---|---|');
  for (const casa of ['camara', 'senado'] as const) {
    const c = contagemPorCasa(coleta, casa);
    linhas.push(`| ${NOME_CASA[casa]} | ${c.total} | ${c.nominais} | ${c.semVoto} |`);
  }
  linhas.push('', `Votos: ${coleta.votos.length} · parlamentares: ${coleta.parlamentares.length}`, '');

  const avisos = ordenarAvisos(coleta.avisos);
  if (avisos.length === 0) {
    linhas.push('Nenhum aviso.');
    return `${linhas.join('\n')}\n`;
  }
  const urlApi = new Map(coleta.votacoes.map((v) => [v.id, v.urlApi]));
  linhas.push(`### Avisos (${avisos.length})`, '', '| Tipo | Votação | Detalhe |', '|---|---|---|');
  for (const a of avisos.slice(0, maxLinhas)) {
    const url = urlApi.get(a.votacaoId);
    const votacao = url ? `[${a.votacaoId}](${url})` : a.votacaoId;
    linhas.push(`| ${a.tipo} | ${votacao} | ${celula(a.detalhe)} |`);
  }
  if (avisos.length > maxLinhas) linhas.push('', `… e mais ${avisos.length - maxLinhas} em \`${meta.arquivo}\`.`);
  return `${linhas.join('\n')}\n`;
}
