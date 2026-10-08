/**
 * Importa deputados federais e senadores de 2026 do arquivo de candidatos do TSE.
 *
 *   npm run candidatos -- --arquivo /caminho/consulta_cand_2026_BRASIL.csv
 *   npm run candidatos -- --arquivo ... --gravar     (grava no banco; precisa de SUPABASE_DB_URL)
 *
 * O CSV sai de consulta_cand_2026.zip (https://dadosabertos.tse.jus.br/dataset/candidatos-2026).
 * Fonte: TSE. Só dados públicos; CPF, título, e-mail e outros dados pessoais do arquivo não são lidos.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { conectar, explicarErroConexao, lerConfigConexao } from './conexao.js';
import { anotacao, escreverResumoExecucao, noGithubActions } from './github.js';
import { contarEleitos, contarPorSituacao, FONTE_TSE, lerCandidatos, resumoCandidatos } from './tse/candidatos.js';
import { decodificarLatin1 } from './tse/csv.js';
import { gravarCandidatos } from './tse/gravar-candidatos.js';

const AJUDA = `Uso: npm run candidatos -- --arquivo consulta_cand_2026_BRASIL.csv [opções]

  --arquivo CAMINHO   CSV de candidatos do TSE (Latin-1, separado por ";")
  --ano N             ano da eleição (padrão: 2026)
  --saida PASTA       onde gravar o JSON normalizado (padrão: dados)
  --gravar            grava no banco (SUPABASE_DB_URL e SUPABASE_DB_CA no ambiente)`;

/** Em 2026: 513 deputados federais e 54 senadores (2/3 do Senado). */
const ELEITOS_ESPERADOS = { deputado_federal: 513, senador: 54 } as const;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      arquivo: { type: 'string' },
      ano: { type: 'string', default: '2026' },
      saida: { type: 'string', default: 'dados' },
      gravar: { type: 'boolean', default: false },
      ajuda: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
  });
  if (values.ajuda || !values.arquivo) {
    console.log(AJUDA);
    if (!values.ajuda) process.exitCode = 1;
    return;
  }
  const ano = Number(values.ano);
  if (!Number.isInteger(ano)) throw new Error('--ano deve ser um inteiro');

  const leitura = lerCandidatos(decodificarLatin1(await readFile(values.arquivo)), ano);
  const eleitos = contarEleitos(leitura.candidatos);
  console.log(
    `${leitura.candidatos.length} candidaturas (deputado federal e senador) de ${leitura.linhas} linhas; ` +
      `eleitos: ${eleitos.deputado_federal} deputados federais, ${eleitos.senador} senadores; avisos: ${leitura.avisos.length}`,
  );

  await mkdir(values.saida, { recursive: true });
  const arquivoSaida = path.join(values.saida, `candidatos_tse_${ano}.json`);
  const conteudo = { geradoEm: new Date().toISOString(), fonte: FONTE_TSE, ano, ...leitura };
  await writeFile(arquivoSaida, `${JSON.stringify(conteudo, null, 2)}\n`, 'utf8');
  console.log(`Gravado em ${arquivoSaida}`);

  const conferencia =
    ano === 2026 &&
    (eleitos.deputado_federal !== ELEITOS_ESPERADOS.deputado_federal || eleitos.senador !== ELEITOS_ESPERADOS.senador)
      ? `Eleitos diferentes do esperado (513 deputados federais e 54 senadores): ${eleitos.deputado_federal} e ${eleitos.senador}. Pode haver candidatura sub judice — conferir.`
      : null;
  if (conferencia) console.warn(conferencia);

  let resumoBanco = '';
  if (values.gravar) {
    const db = await conectar(lerConfigConexao());
    try {
      const r = await gravarCandidatos(db, leitura.candidatos);
      resumoBanco = `Banco: ${r.novos} novos, ${r.atualizados} atualizados, ${r.mantidos} mantidos (o banco já tinha arquivo mais novo).`;
      console.log(resumoBanco);
    } finally {
      await db.fechar();
    }
  }

  if (noGithubActions()) {
    await escreverResumoExecucao(`${resumoCandidatos(leitura)}${resumoBanco ? `\n${resumoBanco}\n` : ''}`);
    for (const cargo of ['deputado_federal', 'senador'] as const) {
      const texto = contarPorSituacao(leitura.candidatos, cargo)
        .map(([situacao, n]) => `${situacao}: ${n}`)
        .join('\n');
      console.log(anotacao('notice', texto, `TSE 2026 — ${cargo === 'senador' ? 'senador' : 'deputado federal'} por situação`));
    }
    if (leitura.avisos.length > 0) {
      console.log(anotacao('warning', leitura.avisos.map((a) => `${a.tipo}: ${a.detalhe}`).join('\n'), 'Candidatos TSE — avisos'));
    }
    if (conferencia) console.log(anotacao('warning', conferencia, 'Candidatos TSE — conferência'));
  }
}

main().catch((erro: unknown) => {
  console.error(explicarErroConexao(erro));
  process.exitCode = 1;
});
