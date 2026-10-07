# Fixtures

Respostas reais das APIs oficiais, consultadas em 06–07/10/2026, usadas nos testes para não depender de rede.

| Arquivo | Origem | Observação |
|---|---|---|
| `senado-votacao-2026-06.json` | `GET https://legis.senado.leg.br/dadosabertos/votacao?dataInicio=2026-06-01&dataFim=2026-06-30` | 3 das 4 votações do período (PLP 55/2026, OFS 4/2026 — secreta, PLP 73/2025), com os 81 votos de cada uma. |
| `camara-votacoes-lista-2026-06.json` | `GET https://dadosabertos.camara.leg.br/api/v2/votacoes?dataInicio=2026-06-01&dataFim=2026-06-30&itens=15&ordem=DESC&ordenarPor=dataHoraRegistro` | Primeira página, sem filtro de órgão (mistura plenário e comissões). |
| `camara-votacao-2382675-97.json` | `GET .../api/v2/votacoes/2382675-97` | Lista `objetosPossiveis` encurtada para 2 itens. |
| `camara-votos-2633410-8-trecho.json` | `GET .../api/v2/votacoes/2633410-8/votos` | Trecho: 10 dos 437 votos. |

Conferência feita ao montar as fixtures: o placar contado a partir de `votos[]` bate com o texto oficial (`informeLegislativo.texto`) nas 3 votações do Senado — os testes repetem essa conferência.

Votações sintéticas (inventadas para testar casos sem exemplo real à mão, como "Obstrução") ficam dentro dos próprios testes e estão marcadas como tal.
