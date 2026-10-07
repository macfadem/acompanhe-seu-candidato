/** Exportar/importar a colinha como arquivo, para guardar ou trocar de aparelho. */
import { type Colinha, falha, type Resultado, validarColinha } from './colinha.js';
import { lerDoFragmento } from './compartilhar.js';

export const FORMATO = 'acompanhe-seu-candidato/colinha';
export const NOME_ARQUIVO = 'minha-colinha-2026.json';

export function paraArquivo(colinha: Colinha, agora: Date = new Date()): string {
  return `${JSON.stringify({ formato: FORMATO, versao: 1, exportadoEm: agora.toISOString(), colinha }, null, 2)}\n`;
}

/** Aceita o arquivo exportado, a colinha "pura" em JSON ou um link com `#c=`. */
export function deArquivo(texto: string): Resultado<Colinha> {
  const conteudo = texto.trim();
  if (/^https?:\/\//.test(conteudo)) {
    try {
      return lerDoFragmento(new URL(conteudo).hash) ?? falha('Este link não contém uma colinha.');
    } catch {
      return falha('Link inválido.');
    }
  }
  let dado: unknown;
  try {
    dado = JSON.parse(conteudo);
  } catch {
    return falha('O arquivo não é uma colinha exportada pelo app.');
  }
  if (dado && typeof dado === 'object' && 'formato' in dado) {
    if ((dado as { formato: unknown }).formato !== FORMATO) return falha('O arquivo não é uma colinha exportada pelo app.');
    return validarColinha((dado as { colinha?: unknown }).colinha);
  }
  return validarColinha(dado);
}
