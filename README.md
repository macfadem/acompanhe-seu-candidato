# Acompanhe Seu Candidato

Web app público e gratuito: o eleitor monta a colinha das eleições de 2026 e, depois da eleição, acompanha os deputados federais e senadores que escolheu — votações, notícias e um resumo semanal neutro, sempre com link para a fonte oficial.

> **Status:** em construção. Pronto: coleta de votações nominais de plenário (Câmara e Senado, conferida com dados reais), esquema do banco, gravação no banco (falta escolher o driver), núcleo da colinha e o script do spike de notícias. Próximo: projeto no Supabase, candidatos do TSE e o app.

## Princípios

- **Neutralidade:** mesmos campos, mesma ordem e mesmo tom para todos os políticos e partidos. Sem notas, rankings ou adjetivos.
- **Fonte oficial primeiro:** Câmara, Senado e TSE. Tudo com link.
- **Privacidade:** em quem a pessoa votou é dado sensível e fica só no aparelho dela. O servidor guarda apenas dados públicos.
- **IA explica, não opina:** o resumo usa só os dados fornecidos, cita a fonte de cada frase e nunca recomenda candidato.

## Estrutura

```
packages/pipeline/         coleta, normalização e gravação (roda no GitHub Actions)
  src/camara.ts            API de Dados Abertos da Câmara (v2)
  src/senado.ts            API de Dados Abertos do Senado
  src/categorias.ts        tradução dos códigos de voto para categorias neutras
  src/placar.ts            conferência do placar com o texto oficial
  src/gravar.ts            gravação no Postgres: transação, idempotente
  src/spike/               spike de notícias (GDELT)
  src/relatorio.ts         resumo e avisos (terminal e página da execução no GitHub)
  src/cli.ts               linha de comando da coleta
packages/colinha/          núcleo da colinha no navegador (nada vai ao servidor)
supabase/migrations/       esquema do banco (Postgres/Supabase) com RLS
.github/workflows/         CI e coleta diária
```

## Como rodar

Requisitos: Node.js 22.12 ou mais novo (o CI usa o 24).

```bash
npm install
npm test             # todos os testes (inclui o banco num Postgres em memória)
npm run typecheck

# Coleta votações e grava packages/pipeline/dados/votacoes_<de>_<ate>.json
npm run votacoes -- --de 2026-06-01 --ate 2026-06-30
npm run votacoes -- --casa senado          # últimos 7 dias, só Senado
npm run votacoes -- --ajuda
```

A coleta não precisa de chave: as APIs das duas casas são abertas.

**Windows (PowerShell):** o PowerShell engole o `--` e as opções não chegam ao programa. Rode direto, de dentro de `packages/pipeline`:

```powershell
cd packages\pipeline
npx tsx src/cli.ts --de 2026-06-01 --ate 2026-06-30
npx tsx src/spike-noticias.ts --arquivo dados/votacoes_2026-07-10_2026-10-07.json
```

### Spike de notícias (GDELT)

Mede se a GDELT encontra matérias sobre uma amostra sorteada (com semente fixa) de parlamentares e de votações recentes. Leva poucos minutos.

```bash
npm run votacoes -- --de 2026-07-10 --ate 2026-10-07     # últimos 3 meses
npm run spike:noticias -- --arquivo dados/votacoes_2026-07-10_2026-10-07.json
```

Gera em `packages/pipeline/dados/spike/` um CSV para revisar à mão (colunas `relevante` e `homonimo`) e um resumo com o critério de decisão.

## O que a coleta faz

1. Lista as votações de **plenário** do período (Câmara: `idOrgao=180`; Senado: `informeLegislativo.siglaColegiado = PLEN`).
2. Busca os votos individuais e a **proposição principal** (ex.: o PL afetado, não o requerimento de urgência).
3. Traduz cada voto para uma categoria neutra e **guarda o valor original**:

| Categoria | Exemplos na fonte |
|---|---|
| `sim` / `nao` / `abstencao` / `obstrucao` | Sim, Não, Abstenção, Obstrução |
| `ausente_justificado` | AP (atividade parlamentar), MIS (missão) |
| `licenca` | LS, LP, LAP |
| `presente_sem_voto` | P-NRV |
| `presidente` | Presidente (art. 51 RISF), Art. 17 |
| `secreto` | votação secreta — a escolha não é pública, só a participação. Senado: "Votou". Câmara: voto vazio (`null`) em todos os registros, ex.: escolha de ministro do TCU |
| `outro` | código ainda não mapeado (sempre gera aviso) |

4. Confere o placar contado com o texto oficial da votação (na secreta, o número de participantes com a soma oficial) e registra **avisos** para revisão (código novo, placar divergente, votos indisponíveis, falha pontual de rede, formato desconhecido).

Votação sem votos individuais é simbólica — é o caso da maioria — e não é erro.

Quando algo dá errado:

- **Falha pontual** numa votação (rede, erro 5xx que persiste): ela fica de fora com aviso `falha_coleta`, e a coleta seguinte (últimos 7 dias) tenta de novo.
- **Formato desconhecido** numa votação: ela fica de fora com aviso `formato_inesperado` e o problema resumido; o resto é gravado e a execução termina com erro, para o workflow avisar por e-mail.
- **A lista de votações mudou de formato:** a coleta para inteira, com erro claro.

No GitHub Actions, a página de cada execução mostra um resumo com a tabela de avisos (com link para a API de cada votação), e os primeiros avisos aparecem como anotações. O JSON completo fica como artefato por 30 dias.

## Banco (Supabase)

O Supabase é um Postgres gerenciado com API, armazenamento de arquivos e funções. Aqui ele guarda **só dados públicos**: os jobs gravam; o site lê.

- `supabase/migrations/` cria `parlamentar`, `votacao` e `voto`. Leitura pública; escrita só pelos jobs. Os testes confirmam que um visitante anônimo lê, mas não escreve.
- `gravarColeta()` grava numa transação (tudo ou nada), pode repetir sem duplicar, substitui votos corrigidos pela fonte e nunca apaga votos por causa de uma falha passageira. Falta escolher o driver de conexão.
- Os jobs vão conectar pelo pooler do Supabase em modo sessão (IPv4), com a conexão guardada em GitHub Secrets — nunca no código.

## Colinha (`packages/colinha`)

- Guarda só os códigos dos candidatos (TSE) no `localStorage`; se o armazenamento estiver bloqueado, o app segue em memória.
- Leva a colinha para outro aparelho por link com fragmento (`#c=...`), que o navegador não envia ao servidor, ou por arquivo.
- No app: depois de importar, apagar o fragmento da barra de endereço; analytics e relatório de erros nunca registram `location.hash`.

## Fontes

- Câmara dos Deputados — Dados Abertos: https://dadosabertos.camara.leg.br
- Senado Federal — Dados Abertos: https://legis.senado.leg.br/dadosabertos
- GDELT (só no spike): https://api.gdeltproject.org/api/v2/doc/doc

## Licença

[MIT](LICENSE). Falhas de segurança: veja [SECURITY.md](SECURITY.md).
