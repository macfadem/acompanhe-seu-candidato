/**
 * DADOS FICTÍCIOS para desenvolver e testar o site sem banco. Nomes, partidos (PEX, PFI, PDM),
 * proposições e votos são inventados; nenhum corresponde a pessoa ou votação real.
 * Gerados sempre iguais (sem sorteio), no mesmo formato do arquivo de `npm run votacoes`:
 * 2 deputados e 1 senador por UF, 8 votações na Câmara e 6 no Senado.
 */
import type { CategoriaVoto } from '@acompanhe/pipeline/tipos';
import { UFS } from '../apresentacao/ufs';
import type { ColetaLida } from './formato';

type Parlamentar = ColetaLida['parlamentares'][number];
type Votacao = ColetaLida['votacoes'][number];
type Voto = ColetaLida['votos'][number];
type Casa = Parlamentar['casa'];

const PRENOMES = ['Ana', 'Bruno', 'Carla', 'Daniel', 'Elisa', 'Fábio', 'Glória', 'Heitor', 'Íris'] as const;
const SOBRENOMES = [
  'Exemplo',
  'Modelo',
  'Amostra',
  'Ensaio',
  'Protótipo',
  'Rascunho',
  'Esboço',
  'Demonstração',
  'Ilustração',
] as const;
const PARTIDOS = ['PEX', 'PFI', 'PDM'] as const;

const FONTE = {
  camara: { urlFonte: 'https://dadosabertos.camara.leg.br/', urlApi: 'https://dadosabertos.camara.leg.br/api/v2/votacoes', proposicao: 'https://www.camara.leg.br/' },
  senado: { urlFonte: 'https://legis.senado.leg.br/dadosabertos/', urlApi: 'https://legis.senado.leg.br/dadosabertos/', proposicao: 'https://www25.senado.leg.br/' },
} as const;

interface Roteiro {
  casa: Casa;
  data: string;
  hora: string | null;
  sigla: string;
  numero: string;
  ementa: string;
  descricao: string;
  resultado: Votacao['resultado'];
  secreta?: true;
  semProposicao?: true;
}

const ROTEIRO: readonly Roteiro[] = [
  { casa: 'camara', data: '2026-08-12', hora: '18:20:00', sigla: 'REQ', numero: '310', ementa: '', descricao: 'Aprovado requerimento de encerramento da discussão.', resultado: 'aprovada', semProposicao: true },
  { casa: 'camara', data: '2026-08-26', hora: '19:05:00', sigla: 'PL', numero: '9003', ementa: 'Institui a semana nacional de dados abertos.', descricao: 'Aprovado o Projeto de Lei nº 9.003, de 2026.', resultado: 'aprovada' },
  { casa: 'camara', data: '2026-09-09', hora: '21:10:45', sigla: 'MPV', numero: '1399', ementa: 'Abre crédito extraordinário para ações de Defesa Civil.', descricao: 'Aprovada a Medida Provisória nº 1.399, de 2026.', resultado: 'aprovada' },
  { casa: 'camara', data: '2026-09-23', hora: '17:40:00', sigla: 'PEC', numero: '98', ementa: 'Altera o calendário das sessões legislativas.', descricao: 'Aprovada, em primeiro turno, a Proposta de Emenda à Constituição nº 98, de 2026.', resultado: 'aprovada' },
  { casa: 'camara', data: '2026-10-07', hora: null, sigla: 'PDL', numero: '990', ementa: 'Escolha de autoridade indicada pela Câmara.', descricao: 'Votação secreta para escolha de autoridade.', resultado: 'aprovada', secreta: true },
  { casa: 'camara', data: '2026-10-14', hora: '16:05:00', sigla: 'PLP', numero: '950', ementa: 'Altera regras de transparência de fundos públicos estaduais.', descricao: 'Rejeitada a Emenda de Plenário nº 3 ao Projeto de Lei Complementar nº 950, de 2026.', resultado: 'rejeitada' },
  { casa: 'camara', data: '2026-10-21', hora: '20:15:30', sigla: 'PL', numero: '9004', ementa: 'Cria cadastro nacional de bibliotecas comunitárias.', descricao: 'Rejeitado o Projeto de Lei nº 9.004, de 2026.', resultado: 'rejeitada' },
  { casa: 'camara', data: '2026-10-28', hora: '19:42:10', sigla: 'PL', numero: '9001', ementa: 'Dispõe sobre a publicação, em formato aberto, dos horários do transporte público intermunicipal.', descricao: 'Aprovado o texto-base do Projeto de Lei nº 9.001, de 2026.', resultado: 'aprovada' },
  { casa: 'senado', data: '2026-08-19', hora: '15:40:00', sigla: 'PL', numero: '9003', ementa: 'Institui a semana nacional de dados abertos.', descricao: 'Aprovado o Projeto de Lei nº 9.003, de 2026.', resultado: 'aprovada' },
  { casa: 'senado', data: '2026-09-02', hora: '16:30:00', sigla: 'PL', numero: '9005', ementa: 'Estabelece regras para a divulgação de filas de serviços públicos.', descricao: 'Aprovado o Projeto de Lei nº 9.005, de 2026.', resultado: 'aprovada' },
  { casa: 'senado', data: '2026-09-24', hora: '19:02:00', sigla: 'PEC', numero: '98', ementa: 'Altera o calendário das sessões legislativas.', descricao: 'Aprovada, em primeiro turno, a Proposta de Emenda à Constituição nº 98, de 2026.', resultado: 'aprovada' },
  { casa: 'senado', data: '2026-10-08', hora: '16:12:30', sigla: 'PL', numero: '9002', ementa: 'Cria programa de apoio a hortas escolares.', descricao: 'Rejeitado o Projeto de Lei nº 9.002, de 2026.', resultado: 'rejeitada' },
  { casa: 'senado', data: '2026-10-22', hora: '17:45:00', sigla: 'OFS', numero: '12', ementa: 'Indicação para chefiar missão diplomática.', descricao: 'Votação secreta para escolha de chefe de missão diplomática.', resultado: 'aprovada', secreta: true },
  { casa: 'senado', data: '2026-10-29', hora: '15:30:00', sigla: 'PLP', numero: '120', ementa: 'Estabelece prazos para a publicação de contratos de municípios.', descricao: 'Aprovado o Projeto de Lei Complementar nº 120, de 2026.', resultado: 'aprovada' },
];

/** Sequência fixa de registros; `null` = a fonte não traz registro (na Câmara, quem não votou não é listado). */
const PADRAO: Record<Casa, readonly (CategoriaVoto | null)[]> = {
  camara: ['sim', 'nao', 'sim', 'sim', 'abstencao', 'nao', 'sim', null, 'obstrucao', 'sim', 'nao', 'sim', 'presidente'],
  senado: ['sim', 'nao', 'sim', 'ausente_justificado', 'sim', 'nao', 'licenca', 'sim', 'abstencao', 'nao_compareceu', 'sim', 'presente_sem_voto', 'nao', 'presidente'],
};

const ORIGINAL: Record<Casa, Partial<Record<CategoriaVoto, { valor: string | null; motivo?: string }>>> = {
  camara: {
    sim: { valor: 'Sim' },
    nao: { valor: 'Não' },
    abstencao: { valor: 'Abstenção' },
    obstrucao: { valor: 'Obstrução' },
    presidente: { valor: 'Art. 17' },
    secreto: { valor: null },
  },
  senado: {
    sim: { valor: 'Sim' },
    nao: { valor: 'Não' },
    abstencao: { valor: 'Abstenção' },
    presidente: { valor: 'Presidente (art. 51 RISF)' },
    secreto: { valor: 'Votou' },
    ausente_justificado: { valor: 'AP', motivo: 'Atividade parlamentar' },
    licenca: { valor: 'LS', motivo: 'Licença saúde' },
    nao_compareceu: { valor: 'NCom' },
    presente_sem_voto: { valor: 'P-NRV' },
  },
};

function parlamentares(): Parlamentar[] {
  const lista: Parlamentar[] = [];
  UFS.forEach(([uf], u) => {
    for (let i = 0; i < 3; i += 1) {
      const n = u * 3 + i;
      const casa: Casa = i < 2 ? 'camara' : 'senado';
      const idCasa = casa === 'camara' ? String(990001 + u * 2 + i) : String(9901 + u);
      lista.push({
        id: `${casa}:${idCasa}`,
        casa,
        idCasa,
        // Par (prenome, sobrenome) único para cada um dos 81.
        nome: `${PRENOMES[n % 9]} ${SOBRENOMES[(Math.floor(n / 9) + (n % 9) * 2) % 9]}`,
        partido: PARTIDOS[n % 3] ?? null,
        uf,
        referenciaData: casa === 'camara' ? '2026-10-28' : '2026-10-29',
      });
    }
  });
  return lista;
}

export function coletaDeExemplo(): ColetaLida & { avisos: never[] } {
  const pessoas = parlamentares();
  const votacoes: Votacao[] = [];
  const votos: Voto[] = [];

  ROTEIRO.forEach((r, v) => {
    const idCasa = r.casa === 'camara' ? `${9900001 + v}-1` : String(7990001 + v);
    const id = `${r.casa}:${idCasa}`;
    const placar = { sim: 0, nao: 0, abstencao: 0 };

    pessoas
      .filter((p) => p.casa === r.casa)
      .forEach((p, k) => {
        const padrao = PADRAO[r.casa];
        const categoria = r.secreta ? (k % 7 === 3 ? null : 'secreto') : (padrao[(k * 5 + v * 3) % padrao.length] ?? null);
        if (categoria === null) return;
        if (categoria === 'sim' || categoria === 'nao' || categoria === 'abstencao') placar[categoria] += 1;
        const original = ORIGINAL[r.casa][categoria];
        // Um caso de troca de partido, para o site mostrar "partido na data".
        const partido = k === 1 && r.data < '2026-10-01' ? 'PDM' : p.partido;
        votos.push({
          votacaoId: id,
          parlamentarId: p.id,
          categoria,
          valorOriginal: original?.valor ?? null,
          motivo: original?.motivo ?? null,
          partido,
          uf: p.uf,
        });
      });

    votacoes.push({
      id,
      casa: r.casa,
      idCasa,
      data: r.data,
      dataHora: r.hora ? `${r.data}T${r.hora}` : null,
      orgao: 'PLEN',
      descricao: `${r.descricao} (exemplo fictício)`,
      resultado: r.resultado,
      secreta: r.secreta ?? false,
      nominal: true,
      proposicao: r.semProposicao
        ? null
        : { sigla: r.sigla, numero: r.numero, ano: 2026, ementa: `Exemplo fictício: ${r.ementa}`, idCasa: `99${r.numero}`, url: FONTE[r.casa].proposicao },
      placar: r.secreta ? null : placar,
      urlFonte: FONTE[r.casa].urlFonte,
      urlApi: FONTE[r.casa].urlApi,
    });
  });

  return { intervalo: { de: '2026-08-01', ate: '2026-10-31' }, parlamentares: pessoas, votacoes, votos, avisos: [] };
}
