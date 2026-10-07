const FORMATO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Aceita só AAAA-MM-DD de uma data que existe (rejeita 2026-02-30). */
export function validarData(data: string): void {
  const m = FORMATO.exec(data);
  if (!m) throw new Error(`Data inválida: "${data}" (use AAAA-MM-DD)`);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (d.toISOString().slice(0, 10) !== data) throw new Error(`Data inexistente: "${data}"`);
}

function paraDate(data: string): Date {
  validarData(data);
  return new Date(`${data}T00:00:00Z`);
}

function paraTexto(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function somarDias(data: string, dias: number): string {
  const d = paraDate(data);
  d.setUTCDate(d.getUTCDate() + dias);
  return paraTexto(d);
}

/**
 * Quebra [de, ate] em janelas que nunca atravessam um mês.
 * A API da Câmara aceita no máximo 3 meses por consulta; janelas mensais ficam bem abaixo disso.
 */
export function janelasMensais(de: string, ate: string): Array<{ de: string; ate: string }> {
  const inicio = paraDate(de);
  const fim = paraDate(ate);
  if (inicio > fim) throw new Error(`Intervalo invertido: ${de} é depois de ${ate}`);
  const janelas: Array<{ de: string; ate: string }> = [];
  let cursor = inicio;
  while (cursor <= fim) {
    const fimDoMes = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0));
    const fimJanela = fimDoMes < fim ? fimDoMes : fim;
    janelas.push({ de: paraTexto(cursor), ate: paraTexto(fimJanela) });
    cursor = new Date(fimJanela);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return janelas;
}

/** Data de hoje no horário de Brasília, que é o fuso das datas nas duas casas. */
export function hojeEmBrasilia(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora);
}
