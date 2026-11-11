/**
 * Escolhe de onde o site lê. Sem configuração, usa os dados de exemplo (fictícios);
 * com `DADOS_ARQUIVO`, lê um arquivo gerado por `npm run votacoes`.
 * A leitura do Supabase entra aqui como mais uma opção.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { criarFonteDaColeta, lerColeta } from './coleta';
import { coletaDeExemplo } from './exemplo';
import type { FonteDeDados } from './modelo';

type Ambiente = Readonly<Record<string, string | undefined>>;

/** Uma fonte por processo: o arquivo é lido e validado uma vez (reinicie o servidor ao trocá-lo). */
let memoria: { chave: string; fonte: FonteDeDados } | undefined;

export function fonteDeDados(ambiente: Ambiente = process.env): FonteDeDados {
  const caminho = ambiente.DADOS_ARQUIVO?.trim() || null;
  const chave = caminho ?? '(exemplo)';
  if (memoria?.chave === chave) return memoria.fonte;
  const fonte = caminho ? fonteDoArquivo(caminho) : fonteDeExemplo();
  memoria = { chave, fonte };
  return fonte;
}

export function fonteDeExemplo(): FonteDeDados {
  return criarFonteDaColeta(lerColeta(coletaDeExemplo(), 'os dados de exemplo'), { tipo: 'exemplo' });
}

export function fonteDoArquivo(caminho: string): FonteDeDados {
  const absoluto = resolve(caminho);
  let texto: string;
  try {
    texto = readFileSync(absoluto, 'utf8');
  } catch (erro) {
    const codigo = erro instanceof Error && 'code' in erro ? String(erro.code) : String(erro);
    throw new Error(`DADOS_ARQUIVO: não foi possível ler ${absoluto} (${codigo})`, { cause: erro });
  }
  let conteudo: unknown;
  try {
    conteudo = JSON.parse(texto);
  } catch (erro) {
    throw new Error(`DADOS_ARQUIVO: ${absoluto} não é um JSON válido`, { cause: erro });
  }
  const coleta = lerColeta(conteudo, absoluto);
  return criarFonteDaColeta(coleta, {
    tipo: 'arquivo',
    caminho: absoluto,
    geradoEm: coleta.geradoEm ?? null,
    intervalo: coleta.intervalo ?? null,
  });
}
