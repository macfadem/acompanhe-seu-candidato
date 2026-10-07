import { coletarCamara } from './camara.js';
import { validarData } from './datas.js';
import { type ClienteHttp, criarCliente } from './http.js';
import { juntarColetas, ordenarColeta } from './juntar.js';
import { coletarSenado } from './senado.js';
import type { Casa, Coleta } from './tipos.js';

export interface OpcoesColeta {
  de: string;
  ate: string;
  casas?: readonly Casa[];
  /** Requisições simultâneas na Câmara (padrão 3; mais que isso gera HTTP 429). */
  concorrencia?: number;
  cliente?: ClienteHttp;
}

/** Coleta votações nominais de plenário da Câmara e/ou do Senado no intervalo. */
export async function coletar(opcoes: OpcoesColeta): Promise<Coleta> {
  const { de, ate, casas = ['camara', 'senado'], concorrencia = 3, cliente = criarCliente() } = opcoes;
  validarData(de);
  validarData(ate);
  const partes: Coleta[] = [];
  if (casas.includes('camara')) partes.push(await coletarCamara(cliente, de, ate, concorrencia));
  if (casas.includes('senado')) partes.push(await coletarSenado(cliente, de, ate));
  return ordenarColeta(juntarColetas(...partes));
}
