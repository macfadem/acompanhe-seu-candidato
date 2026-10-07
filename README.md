# Acompanhe Seu Candidato

Web app público e gratuito: o eleitor monta a colinha das eleições de 2026 e, depois da eleição, acompanha os deputados federais e senadores que escolheu — votações, notícias e um resumo semanal neutro, sempre com link para a fonte oficial.

> **Status:** em construção. Pronto: coleta de votações nominais de plenário (Câmara e Senado, conferida com dados reais), esquema do banco, gravação no banco via `pg` (liga quando os secrets existirem), núcleo da colinha e o script do spike de notícias. Próximo: projeto no Supabase, candidatos do TSE e o app.

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
  src/conexao.ts           conexão `pg` com SSL validado (verify-full)
  src/migrar.ts            aplica as migrações pendentes
  src/banco-cli.ts         linha de comando: npm run migrar / npm run gravar
  src/spike/               spike de notícias (GDELT)
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
# Com um Postgres descartável, roda também a integração pelo driver pg (APAGA o schema public):
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres npm test
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

## Banco (Supabase)

O Supabase é um Postgres gerenciado com API, armazenamento de arquivos e funções. Aqui ele guarda **só dados públicos**: os jobs gravam; o site lê.

- `supabase/migrations/` cria `parlamentar`, `votacao` e `voto`. Leitura pública; escrita só pelos jobs. Os testes confirmam que um visitante anônimo lê, mas não escreve.
- `npm run migrar` aplica as migrações pendentes, cada uma na sua transação, e registra em `supabase_migrations.schema_migrations` (a mesma tabela da CLI do Supabase).
- `npm run gravar` valida os arquivos `dados/votacoes_*.json` inteiros e só então grava, com `gravarColeta()`: uma transação por arquivo (tudo ou nada), pode repetir sem duplicar, substitui votos corrigidos pela fonte e nunca apaga votos por causa de uma falha passageira.
- Driver: `pg` (node-postgres), uma conexão por execução.

### Como ligar (uma vez)

1. **Criar o projeto:** em [supabase.com](https://supabase.com) → *New project*, região **South America (São Paulo)**. Guarde a senha do banco num gerenciador de senhas.
2. **Pegar a conexão:** botão **Connect** no topo do projeto → **Session pooler** (porta 5432, funciona em IPv4 — a conexão direta não serve para o GitHub Actions). Formato: `postgresql://postgres.<ref>:<senha>@<host do pooler>:5432/postgres`. Se a senha tiver caracteres especiais, use-a codificada (ex.: `@` vira `%40`).
3. **Baixar o certificado:** *Project Settings* → *Database* → **SSL Configuration** → *Download certificate* (`prod-ca-2021.crt`). Com ele a conexão valida o servidor (equivale a `sslmode=verify-full`); sem ele, o código se recusa a conectar.
4. **Cadastrar os secrets** no GitHub: *Settings* → *Secrets and variables* → *Actions* → *New repository secret*:
   - `SUPABASE_DB_URL` = a conexão do passo 2;
   - `SUPABASE_DB_CA` = o conteúdo inteiro do arquivo `.crt` (de `-----BEGIN CERTIFICATE-----` a `-----END CERTIFICATE-----`).
5. **Aplicar as migrações e gravar:** Actions → *Coleta de votações* → *Run workflow* (de preferência com um período, ex.: 2026-01-01 a hoje). Com os secrets cadastrados, o workflow aplica as migrações pendentes e grava. Sem eles, só gera o artefato e avisa.

Opcional, do seu computador (a URL e o certificado ficam só em variáveis de ambiente — nunca em arquivo do repositório):

```bash
export SUPABASE_DB_URL='postgresql://postgres.<ref>:<senha>@<host>:5432/postgres'
export SUPABASE_DB_CA="$(cat ~/Downloads/prod-ca-2021.crt)"
npm run migrar
npm run gravar -- --arquivo dados/votacoes_2026-06-01_2026-06-30.json
```

### Segurança da conexão

- A URL só existe no secret e no passo de gravação do workflow; `npm ci` e a coleta não a recebem. Mensagens de erro passam por um filtro que remove a URL e a senha.
- Parâmetros como `?sslmode=disable` na URL são ignorados: fora de `localhost`, o SSL sempre valida o certificado e o nome do servidor.
- O CI testa a gravação num Postgres de verdade (`services: postgres`), inclusive pela linha de comando e com senha errada (a senha não aparece na saída).

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
