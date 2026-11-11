/** Montadores de coletas pequenas e sintéticas para os testes (nada aqui é dado real). */
import type { ColetaLida } from '../src/fontes/formato';

type Parlamentar = ColetaLida['parlamentares'][number];
type Votacao = ColetaLida['votacoes'][number];
type Voto = ColetaLida['votos'][number];

export function parlamentar(id: string, nome: string, extra: Partial<Parlamentar> = {}): Parlamentar {
  const [casa, idCasa] = id.split(':') as [Parlamentar['casa'], string];
  return { id, casa, idCasa, nome, partido: 'PEX', uf: 'MG', referenciaData: '2026-10-28', ...extra };
}

export function votacao(id: string, data: string, extra: Partial<Votacao> = {}): Votacao {
  const [casa, idCasa] = id.split(':') as [Votacao['casa'], string];
  return {
    id,
    casa,
    idCasa,
    data,
    dataHora: `${data}T15:00:00`,
    orgao: 'PLEN',
    descricao: `Votação sintética ${id}`,
    resultado: 'aprovada',
    secreta: false,
    nominal: true,
    proposicao: { sigla: 'PL', numero: '9001', ano: 2026, ementa: null, idCasa: null, url: null },
    placar: { sim: 10, nao: 5, abstencao: 0 },
    urlFonte: 'https://dadosabertos.camara.leg.br/',
    urlApi: 'https://dadosabertos.camara.leg.br/api/v2/votacoes',
    ...extra,
  };
}

export function voto(votacaoId: string, parlamentarId: string, extra: Partial<Voto> = {}): Voto {
  return {
    votacaoId,
    parlamentarId,
    categoria: 'sim',
    valorOriginal: 'Sim',
    motivo: null,
    partido: 'PEX',
    uf: 'MG',
    ...extra,
  };
}

export function coleta(partes: Partial<ColetaLida> = {}): ColetaLida {
  return { parlamentares: [], votacoes: [], votos: [], ...partes };
}
