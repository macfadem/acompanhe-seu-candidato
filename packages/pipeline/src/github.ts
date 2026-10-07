/**
 * Saídas para o GitHub Actions: anotações (::notice/::warning/::error) e o resumo
 * em Markdown da página da execução ($GITHUB_STEP_SUMMARY). Só para dados públicos:
 * nada aqui deve receber segredo, URL de conexão ou dado de usuário.
 */
import { appendFile } from 'node:fs/promises';

export type NivelAnotacao = 'notice' | 'warning' | 'error';

/** Verdadeiro quando o processo roda num job do GitHub Actions. */
export const noGithubActions = (env: NodeJS.ProcessEnv = process.env): boolean => env.GITHUB_ACTIONS === 'true';

/** Escapes dos comandos de workflow (mesmas regras do @actions/core). */
const escaparDado = (texto: string) => texto.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
const escaparPropriedade = (texto: string) => escaparDado(texto).replace(/:/g, '%3A').replace(/,/g, '%2C');

/**
 * Monta um comando de anotação. Quebras de linha viram %0A, então a mensagem inteira
 * fica numa linha do log e não abre brecha para outro comando.
 * O GitHub mostra até 10 anotações de cada nível por passo: agrupe linhas numa só.
 */
export function anotacao(nivel: NivelAnotacao, mensagem: string, titulo?: string): string {
  const propriedades = titulo ? ` title=${escaparPropriedade(titulo)}` : '';
  return `::${nivel}${propriedades}::${escaparDado(mensagem)}`;
}

/** Acrescenta Markdown ao resumo da execução. Fora do Actions não faz nada e devolve false. */
export async function escreverResumoExecucao(markdown: string, env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  const destino = env.GITHUB_STEP_SUMMARY;
  if (!destino) return false;
  await appendFile(destino, markdown.endsWith('\n') ? markdown : `${markdown}\n`, 'utf8');
  return true;
}

/** Link da execução atual (para o resumo apontar onde baixar os artefatos), ou null fora do Actions. */
export function urlExecucao(env: NodeJS.ProcessEnv = process.env): string | null {
  const { GITHUB_SERVER_URL: servidor, GITHUB_REPOSITORY: repo, GITHUB_RUN_ID: id } = env;
  return servidor && repo && id ? `${servidor}/${repo}/actions/runs/${id}` : null;
}
