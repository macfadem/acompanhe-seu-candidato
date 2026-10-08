/**
 * Coleta votações nominais de plenário e grava um JSON normalizado.
 *
 *   npm run votacoes -- --de 2026-06-01 --ate 2026-06-30
 *
 * Só lida com dados públicos das casas legislativas.
 */
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { coletar } from './coleta.js';
import { hojeEmBrasilia, somarDias, validarData } from './datas.js';
import { anotacoesGithub, detalhesAvisos, resumoMarkdown, resumoTexto } from './relatorio.js';
import type { Casa } from './tipos.js';

const AJUDA = `Uso: npm run votacoes -- [opções]

  --de AAAA-MM-DD      início (padrão: 7 dias atrás, horário de Brasília)
  --ate AAAA-MM-DD     fim (padrão: hoje)
  --casa camara|senado|ambas   (padrão: ambas)
  --saida PASTA        onde gravar o JSON (padrão: dados)
  --concorrencia N     requisições simultâneas na Câmara (padrão: 3)
  --ajuda              mostra esta ajuda`;

const FONTES = [
  'Câmara dos Deputados — Dados Abertos (https://dadosabertos.camara.leg.br)',
  'Senado Federal — Dados Abertos (https://legis.senado.leg.br/dadosabertos)',
];

function lerCasas(valor: string): Casa[] {
  if (valor === 'ambas') return ['camara', 'senado'];
  if (valor === 'camara' || valor === 'senado') return [valor];
  throw new Error(`--casa inválida: "${valor}" (use camara, senado ou ambas)`);
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      de: { type: 'string' },
      ate: { type: 'string' },
      casa: { type: 'string', default: 'ambas' },
      saida: { type: 'string', default: 'dados' },
      concorrencia: { type: 'string', default: '3' },
      ajuda: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
  });
  if (values.ajuda) {
    console.log(AJUDA);
    return;
  }

  const ate = values.ate ?? hojeEmBrasilia();
  const de = values.de ?? somarDias(ate, -7);
  validarData(de);
  validarData(ate);
  const casas = lerCasas(values.casa);
  const concorrencia = Number(values.concorrencia);
  if (!Number.isInteger(concorrencia) || concorrencia < 1 || concorrencia > 6) {
    throw new Error('--concorrencia deve ser um inteiro de 1 a 6');
  }

  console.log(`Coletando ${casas.join(' e ')} de ${de} a ${ate}…`);
  const coleta = await coletar({ de, ate, casas, concorrencia });

  await mkdir(values.saida, { recursive: true });
  const arquivo = path.join(values.saida, `votacoes_${de}_${ate}.json`);
  const conteudo = { geradoEm: new Date().toISOString(), intervalo: { de, ate }, casas, fontes: FONTES, ...coleta };
  await writeFile(arquivo, `${JSON.stringify(conteudo, null, 2)}\n`, 'utf8');
  console.log(`${resumoTexto(coleta)}\nGravado em ${arquivo}`);
  if (coleta.avisos.length > 0) console.log(`\nAvisos para revisar:\n${detalhesAvisos(coleta.avisos)}`);

  // Formato desconhecido precisa de ajuste no código: o resto é gravado, mas a execução
  // termina com erro para que o workflow diário avise por e-mail.
  const foraDoFormato = coleta.avisos.filter((a) => a.tipo === 'formato_inesperado').length;
  if (foraDoFormato > 0) {
    console.error(
      `\n${foraDoFormato} votação(ões) ficaram de fora: a API respondeu num formato que o código ainda não conhece.`,
    );
    process.exitCode = 1;
  }

  // No GitHub Actions: cada aviso vira uma anotação, e a página da execução ganha um resumo.
  if (process.env.GITHUB_ACTIONS === 'true') {
    for (const linha of anotacoesGithub(coleta.avisos, arquivo)) console.log(linha);
    const resumoExecucao = process.env.GITHUB_STEP_SUMMARY;
    if (resumoExecucao) await appendFile(resumoExecucao, resumoMarkdown(coleta, { de, ate, arquivo }), 'utf8');
  }
}

main().catch((erro: unknown) => {
  console.error(erro instanceof Error ? erro.message : erro);
  if (erro instanceof Error && erro.cause) console.error('Causa:', erro.cause);
  process.exitCode = 1;
});
