/**
 * Liga os candidatos do TSE aos parlamentares da Câmara e do Senado.
 *
 *   npm run vincular -- --candidatos dados/candidatos_tse_2026.json
 *   npm run vincular -- --candidatos dados/candidatos_tse_2026.json --gravar
 *
 * Lê o JSON de "npm run candidatos", baixa as listas oficiais (Câmara e Senado), aplica
 * vinculos-manuais.json e grava dados/vinculos_tse_<ano>.json (e o banco, com --gravar).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { conectar, explicarErroConexao, lerConfigConexao } from './conexao.js';
import { anotacao, escreverResumoExecucao, noGithubActions } from './github.js';
import { criarCliente } from './http.js';
import { validar } from './validar.js';
import { ArquivoManuais, casar, type VinculoManual } from './vinculo/casar.js';
import { gravarVinculos } from './vinculo/gravar-vinculos.js';
import { listaCamara, listaSenado } from './vinculo/listas.js';
import { contarPorCargo, eleitosSemVinculo, FONTES_VINCULO, resumoVinculos } from './vinculo/resumo.js';

const MANUAIS_PADRAO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../vinculos-manuais.json');

const AJUDA = `Uso: npm run vincular -- --candidatos dados/candidatos_tse_2026.json [opções]

  --candidatos CAMINHO   saída de "npm run candidatos"
  --manuais CAMINHO      ajustes revisados à mão (padrão: packages/pipeline/vinculos-manuais.json)
  --saida PASTA          onde gravar o JSON (padrão: dados)
  --gravar               grava no banco (SUPABASE_DB_URL e SUPABASE_DB_CA no ambiente)`;

const ArquivoCandidatos = z.object({
  ano: z.number().int(),
  candidatos: z.array(
    z.object({
      sqCandidato: z.string().regex(/^\d+$/),
      ano: z.number().int(),
      cargo: z.enum(['deputado_federal', 'senador']),
      uf: z.string().regex(/^[A-Z]{2}$/),
      numero: z.number().int(),
      nomeUrna: z.string().min(1),
      nomeCivil: z.string().min(1),
      partido: z.string().min(1),
      federacao: z.string().nullable(),
      cdSituacaoTotalizacao: z.number().int().nullable(),
      situacaoTotalizacao: z.string().nullable(),
      geradoEmTse: z.string(),
    }),
  ),
});

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      candidatos: { type: 'string' },
      manuais: { type: 'string', default: MANUAIS_PADRAO },
      saida: { type: 'string', default: 'dados' },
      gravar: { type: 'boolean', default: false },
      ajuda: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
  });
  if (values.ajuda || !values.candidatos) {
    console.log(AJUDA);
    if (!values.ajuda) process.exitCode = 1;
    return;
  }

  const { ano, candidatos } = validar(ArquivoCandidatos, JSON.parse(await readFile(values.candidatos, 'utf8')), values.candidatos);
  const manuais: VinculoManual[] = validar(ArquivoManuais, JSON.parse(await readFile(values.manuais, 'utf8')), values.manuais);

  const cliente = criarCliente({ tentativas: 5 });
  console.log('Baixando as listas da Câmara (legislaturas 55 a 57) e do Senado…');
  const lista = [...(await listaCamara(cliente)), ...(await listaSenado(cliente))];
  const resultado = casar(candidatos, lista, manuais);
  const porCargo = contarPorCargo(candidatos, resultado);
  console.log(
    `${resultado.vinculos.length} vínculos; eleitos com id na casa do cargo: ` +
      `${porCargo.deputado_federal.naCasaDoCargo}/${porCargo.deputado_federal.eleitos} deputados, ` +
      `${porCargo.senador.naCasaDoCargo}/${porCargo.senador.eleitos} senadores; sugestões: ${resultado.sugestoes.length}`,
  );

  await mkdir(values.saida, { recursive: true });
  const arquivo = path.join(values.saida, `vinculos_tse_${ano}.json`);
  const conteudo = {
    geradoEm: new Date().toISOString(),
    fontes: FONTES_VINCULO,
    ano,
    listas: { camara: lista.filter((p) => p.casa === 'camara').length, senado: lista.filter((p) => p.casa === 'senado').length },
    ...resultado,
    eleitosSemVinculo: eleitosSemVinculo(candidatos, resultado),
  };
  await writeFile(arquivo, `${JSON.stringify(conteudo, null, 2)}\n`, 'utf8');
  console.log(`Gravado em ${arquivo}`);

  let resumoBanco = '';
  if (values.gravar) {
    const db = await conectar(lerConfigConexao());
    try {
      const r = await gravarVinculos(db, ano, resultado.vinculos);
      resumoBanco = `Banco: ${r.depois} vínculos gravados (antes: ${r.antes}).`;
      console.log(resumoBanco);
    } finally {
      await db.fechar();
    }
  }

  if (noGithubActions()) {
    await escreverResumoExecucao(`${resumoVinculos(candidatos, resultado)}${resumoBanco ? `\n${resumoBanco}\n` : ''}`);
    const linhas = (['deputado_federal', 'senador'] as const).map((cargo) => {
      const t = porCargo[cargo];
      return `${cargo === 'senador' ? 'Senador' : 'Deputado federal'}: ${t.eleitos} eleitos — ${t.naCasaDoCargo} com id na casa, ${t.soNaOutraCasa} só na outra casa, ${t.semVinculo} sem id, ${t.comSugestao} com sugestão`;
    });
    console.log(anotacao('notice', linhas.join('\n'), 'Vínculo TSE ↔ Câmara/Senado'));
    if (resultado.sugestoes.length > 0) {
      const texto = resultado.sugestoes
        .slice(0, 25)
        .map((s) => `${s.candidato} → ${s.parlamentar} [${s.motivo}; SQ ${s.sqCandidato}]`)
        .join('\n');
      console.log(anotacao('warning', texto, `Vínculo — sugestões para revisar (${resultado.sugestoes.length})`));
    }
  }
}

main().catch((erro: unknown) => {
  console.error(explicarErroConexao(erro));
  process.exitCode = 1;
});
