import { chave } from './texto.js';
import type { CategoriaVoto } from './tipos.js';

export interface Classificacao {
  categoria: CategoriaVoto;
  /** false quando o código não está no mapeamento conhecido: vira aviso para revisão. */
  conhecido: boolean;
}

/** Palavras com o mesmo sentido nas duas casas. */
const COMUNS = new Map<string, CategoriaVoto>([
  ['sim', 'sim'],
  ['nao', 'nao'],
  ['abstencao', 'abstencao'],
  ['obstrucao', 'obstrucao'],
]);

/** Códigos de `siglaVotoParlamentar` observados na API do Senado (junho/2026). */
const SENADO = new Map<string, CategoriaVoto>([
  ['votou', 'secreto'], // votação secreta: só os totais são públicos
  ['ap', 'ausente_justificado'], // Atividade parlamentar
  ['mis', 'ausente_justificado'], // Missão da Casa no País/exterior
  ['ls', 'licenca'], // Licença saúde
  ['lp', 'licenca'], // Licença particular
  ['lap', 'licenca'], // Licença paternidade ou ao adotante
  ['p-nrv', 'presente_sem_voto'], // Presente – não registrou voto
]);

/** Classifica o `tipoVoto` da API da Câmara. */
export function classificarVotoCamara(tipoVoto: string): Classificacao {
  const k = chave(tipoVoto);
  const comum = COMUNS.get(k);
  if (comum) return { categoria: comum, conhecido: true };
  // Quem preside a sessão é registrado pelo art. 17 do Regimento Interno (conferir o texto exato na API).
  if (/^art(igo)?\.?\s*17\b/.test(k)) return { categoria: 'presidente', conhecido: true };
  return { categoria: 'outro', conhecido: false };
}

/** Classifica o `siglaVotoParlamentar` da API do Senado, usando a descrição oficial como apoio. */
export function classificarVotoSenado(sigla: string, descricao?: string | null): Classificacao {
  const k = chave(sigla);
  const conhecida = COMUNS.get(k) ?? SENADO.get(k);
  if (conhecida) return { categoria: conhecida, conhecido: true };
  if (k.startsWith('presidente')) return { categoria: 'presidente', conhecido: true };

  // Código novo: usa a descrição oficial só quando ela não deixa dúvida, e marca para revisão.
  const d = descricao ? chave(descricao) : '';
  if (d.startsWith('licenca')) return { categoria: 'licenca', conhecido: false };
  if (d.includes('atividade parlamentar') || d.startsWith('missao')) {
    return { categoria: 'ausente_justificado', conhecido: false };
  }
  return { categoria: 'outro', conhecido: false };
}
