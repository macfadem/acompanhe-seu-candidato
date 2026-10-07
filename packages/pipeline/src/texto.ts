/** Remove acentos (decomposição NFD + remoção das marcas combinantes). */
export function semAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Forma canônica para comparar rótulos das APIs: sem acento, minúsculas e espaços simples. */
export function chave(texto: string): string {
  return semAcentos(texto).toLowerCase().replace(/\s+/g, ' ').trim();
}
