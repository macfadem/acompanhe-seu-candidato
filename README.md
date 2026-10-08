# Acompanhe Seu Candidato

Web app público e gratuito: o eleitor monta a colinha das eleições de 2026 e, depois da eleição, acompanha os deputados federais e senadores que escolheu — votações, notícias e um resumo semanal neutro, sempre com link para a fonte oficial.

> **Status:** em construção. Pronto: coleta de votações nominais de plenário (Câmara e Senado, conferida com dados reais), candidatos do TSE 2026 com a situação da totalização, vínculo dos candidatos com a Câmara e o Senado, gravação no banco via `pg` (liga quando os secrets do Supabase existirem), núcleo da colinha e o spike de notícias. Próximo: projeto no Supabase, fonte de notícias e o app.

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
  src/tse/                 candidatos do TSE: leitor de CSV, importador e gravação
  src/tse-cli.ts           linha de comando: npm run candidatos
  src/vinculo/             vínculo candidato do TSE ↔ parlamentar (listas oficiais, regra, gravação)
  src/vinculo-cli.ts       linha de comando: npm run vincular
  src/spike/               spike de notícias (GDELT)
  src/relatorio.ts         resumo e avisos (terminal e página da execução no GitHub)
  src/cli.ts               linha de comando da coleta
  src/github.ts            anotações e resumo da página de execução do GitHub Actions
packages/colinha/          núcleo da colinha no navegador (nada vai ao servidor)
supabase/migrations/       esquema do banco (Postgres/Supabase) com RLS
.github/workflows/         CI, coleta diária e spike de notícias (manual)
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

Mede se a GDELT encontra matérias sobre uma amostra sorteada (com semente fixa) de parlamentares e de votações recentes. A GDELT busca na tradução automática das matérias para o inglês, então os termos de apoio da consulta vão em inglês (`deputy`, `senator`).

**No GitHub Actions** (sem precisar de computador): Actions → *Spike de notícias (GDELT)* → *Run workflow*. Ele coleta as votações dos últimos 85 dias, roda o spike e:

- escreve o resumo e a cobertura de cada alvo na página da execução (anotações e *Summary*);
- guarda o CSV e o resumo no artefato `spike-noticias` (30 dias). Para baixar: na página da execução, seção **Artifacts**, ou `gh run download <id> -n spike-noticias -R macfadem/acompanhe-seu-candidato`;
- o CSV usa `;` e vem com BOM: abre direto no Excel em português; no Google Planilhas, importe com separador "ponto e vírgula".

No seu computador:

```bash
npm run votacoes -- --de 2026-07-10 --ate 2026-10-07     # últimos 3 meses
npm run spike:noticias -- --arquivo dados/votacoes_2026-07-10_2026-10-07.json
```

Gera em `packages/pipeline/dados/spike/` um CSV para revisar à mão (colunas `relevante` e `homonimo`) e um resumo com o critério de decisão.

## Candidatos do TSE 2026

Importa deputados federais e senadores do arquivo de candidatos do TSE, com a **situação da totalização** (eleito por QP, eleito por média, eleito, suplente, não eleito). Fonte: TSE — Portal de Dados Abertos (licença CC-BY).

- Arquivo: `consulta_cand_2026_BRASIL.csv`, dentro de [`consulta_cand_2026.zip`](https://dadosabertos.tse.jus.br/dataset/candidatos-2026) — Latin-1, separado por `;`.
- O leitor é guiado pelo **cabeçalho** (conferido no arquivo real de 07/10/2026, 50 colunas): a ordem pode mudar; coluna obrigatória ausente é erro.
- **Privacidade:** o arquivo traz CPF, título de eleitor, e-mail, data de nascimento, gênero, cor/raça e outros dados pessoais. Só as colunas necessárias são lidas; nada disso vai para o banco, para o JSON ou para o resumo. Quem informou **nome social** ao TSE é identificado por ele — o nome de registro dessa pessoa não é guardado.
- Candidatura sem totalização no arquivo (`#NULO`, ex.: indeferida ou renúncia) entra sem situação. Em 2026 o campo de situação da candidatura vem vazio (`#NE`) para todos.
- Workflow *Candidatos TSE 2026*: diário até 15/02/2027 (depois, manual). Baixa o zip, importa, liga cada candidato ao id da Câmara/Senado, escreve na página da execução as contagens e, com os secrets do banco, aplica as migrações e grava em `candidato_tse` e `vinculo_parlamentar`.

```bash
# Baixe e descompacte o zip do TSE, depois:
npm run candidatos -- --arquivo /caminho/consulta_cand_2026_BRASIL.csv            # só gera dados/candidatos_tse_2026.json
npm run candidatos -- --arquivo /caminho/consulta_cand_2026_BRASIL.csv --gravar   # grava no banco (secrets no ambiente)
```

### Vínculo com a Câmara e o Senado

Liga cada candidato ao id do parlamentar (`camara:…` / `senado:…`, o mesmo das votações), para a página do eleito mostrar como ele vota.

- Listas oficiais: deputados das legislaturas 55 a 58 (a 58ª entra quando a Câmara cadastrar os eleitos) e senadores em exercício. Do `deputados.csv` da Câmara só o nome civil é lido (o arquivo também traz CPF e nascimento).
- **Automático só com par único por nome civil (ou social) + UF.** Sem CPF.
- O resto vira **sugestão** (só para eleitos) na página da execução: nome de urna igual ao nome parlamentar, nome civil igual em outra UF ou homônimos. Para confirmar ou recusar, edite `packages/pipeline/vinculos-manuais.json` por pull request (`acao`: `vincular` ou `bloquear`); o CI valida o arquivo.
- Eleito sem id (novato) fica sem vínculo; o workflow tenta de novo todo dia até 15/02/2027.

```bash
npm run vincular -- --candidatos dados/candidatos_tse_2026.json            # gera dados/vinculos_tse_2026.json
npm run vincular -- --candidatos dados/candidatos_tse_2026.json --gravar   # e grava no banco
```

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
| `nao_compareceu` | NCom — "Não Compareceu" (só no Senado: a Câmara não lista quem não votou) |
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

- `supabase/migrations/` cria `parlamentar`, `votacao`, `voto`, `candidato_tse` e `vinculo_parlamentar`. Leitura pública; escrita só pelos jobs. Os testes confirmam que um visitante anônimo lê, mas não escreve.
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
- TSE — Portal de Dados Abertos (CC-BY): https://dadosabertos.tse.jus.br
- GDELT (só no spike): https://api.gdeltproject.org/api/v2/doc/doc

## Licença

[MIT](LICENSE). Falhas de segurança: veja [SECURITY.md](SECURITY.md).
