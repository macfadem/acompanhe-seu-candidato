/**
 * Codifica a colinha num texto curto e seguro para URL (base64url de JSON UTF-8).
 * Cabe com folga num QR code.
 */
import { type Colinha, falha, type Resultado, validarColinha } from './colinha.js';

/** Acima disso, o texto não é uma colinha (protege contra links gigantes). */
export const TAMANHO_MAXIMO = 2000;

function paraBase64Url(bytes: Uint8Array): string {
  let binario = '';
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function deBase64Url(texto: string): Uint8Array {
  const base64 = texto.replace(/-/g, '+').replace(/_/g, '/');
  const binario = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

export function codificar(colinha: Colinha): string {
  const enxuta = { v: colinha.v, eleicao: colinha.eleicao, uf: colinha.uf, itens: colinha.itens };
  return paraBase64Url(new TextEncoder().encode(JSON.stringify(enxuta)));
}

export function decodificar(texto: string): Resultado<Colinha> {
  const limpo = texto.trim();
  if (!limpo || limpo.length > TAMANHO_MAXIMO || !/^[A-Za-z0-9_-]+$/.test(limpo)) {
    return falha('Este link não contém uma colinha válida.');
  }
  try {
    const json = new TextDecoder('utf-8', { fatal: true }).decode(deBase64Url(limpo));
    return validarColinha(JSON.parse(json));
  } catch {
    return falha('Este link não contém uma colinha válida.');
  }
}
