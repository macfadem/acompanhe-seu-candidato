/**
 * Leitor de CSV no formato dos arquivos do TSE: separador ";", campos de texto entre
 * aspas (aspas internas duplicadas: ""), números sem aspas, linhas com \r\n ou \n.
 * Sem dependência externa; o arquivo inteiro (≈ 12 MB) cabe na memória.
 */

/** Decodifica bytes Latin-1 (ISO-8859-1), a codificação dos arquivos do TSE. */
export function decodificarLatin1(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('latin1');
}

/** Percorre as linhas do CSV (cada uma como lista de campos). Lança erro em aspas não fechadas. */
export function* linhasCsv(texto: string, separador = ';'): Generator<string[]> {
  let campo = '';
  let linha: string[] = [];
  let entreAspas = false;
  let numeroLinha = 1;
  let inicioCampo = true;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]!;
    if (entreAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          entreAspas = false;
        }
      } else {
        if (c === '\n') numeroLinha++;
        campo += c;
      }
      continue;
    }
    if (c === '"' && inicioCampo) {
      entreAspas = true;
      inicioCampo = false;
    } else if (c === separador) {
      linha.push(campo);
      campo = '';
      inicioCampo = true;
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      linha.push(campo);
      if (!(linha.length === 1 && linha[0] === '')) yield linha; // ignora linhas vazias
      linha = [];
      campo = '';
      inicioCampo = true;
      numeroLinha++;
    } else {
      campo += c;
      inicioCampo = false;
    }
  }
  if (entreAspas) throw new Error(`CSV: aspas não fechadas a partir da linha ${numeroLinha}`);
  if (campo !== '' || linha.length > 0) {
    linha.push(campo);
    yield linha;
  }
}
