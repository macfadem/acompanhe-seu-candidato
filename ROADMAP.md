# Roteiro até o lançamento

Meta: site no ar até **01/02/2027**, quando toma posse a 58ª legislatura — a partir daí, quem montou a colinha acompanha os eleitos.

Cada item cabe numa sessão de trabalho e vira uma branch + pull request. **Pronto quando** é o critério de aceite: o que precisa ser verdade e como conferir.

## Feito

- Coleta das votações nominais de plenário (Câmara e Senado), banco com RLS, candidatos do TSE 2026 e vínculo com a Câmara e o Senado.
- Núcleo da colinha (`packages/colinha`) e spike de notícias (GDELT).
- Site (`packages/app`) com cara de aplicativo: início por estado, busca sem acento, crachá do parlamentar (números do período e grade de registros), comparar de 2 a 5 lado a lado, votações do Congresso, página da votação e "entenda os cargos"; dados de exemplo; testes e build no CI.

## 1. O site lendo dados reais

- [ ] **Projeto no Supabase** (manual): criar o projeto e cadastrar os secrets, como no README. *Pronto quando* a coleta diária grava no banco.
- [ ] **Fonte do Supabase**: implementar `FonteDeDados` (`packages/app/src/fontes/modelo.ts`) lendo `parlamentar`, `votacao` e `voto` com a chave pública (anon) e o RLS. *Pronto quando* `SUPABASE_URL` e `SUPABASE_ANON_KEY` trocam a fonte sem mudar nenhuma página; os testes usam respostas gravadas, sem rede; nenhuma chave `service_role` chega ao site.
- [ ] **Atualização sem novo deploy**: páginas em cache, revalidadas depois da coleta diária. *Pronto quando* um voto novo no banco aparece no site no mesmo dia, sem deploy.
- [ ] **Paginação** dos votos do crachá (hoje, os 50 mais recentes) e das votações do Congresso (hoje, as 60 mais recentes). *Pronto quando* há anterior/próxima com o total certo e o recorte tem teste.
- [ ] **Deploy**: preview por pull request e produção no merge da `main`. *Pronto quando* cada PR ganha um link de preview.

## 2. A colinha no site

- [ ] **Montar a colinha**: UF e busca de candidatos do TSE por nome ou número (deputado federal e senador), com `@acompanhe/colinha`. *Pronto quando* tudo fica só no aparelho (conferido na aba Rede do navegador) e os limites por cargo valem.
- [ ] **Compartilhar e importar** por link `#c=` e por arquivo. *Pronto quando*, depois de importar, o fragmento some da barra de endereço, e analytics e relatório de erros nunca registram `location.hash`.
- [ ] **Meus eleitos**: da colinha para a página de cada eleito, pelo `vinculo_parlamentar`. *Pronto quando* os três casos têm teste: eleito com id, eleito novato ainda sem id e não eleito.
- [ ] **Como funciona**: fontes, categorias neutras, o que fica no aparelho e o que vai ao servidor. *Pronto quando* a página está no rodapé e cada afirmação aponta para a fonte.

## 3. Notícias, resumo e alertas

- [ ] **Fonte de notícias**: decidir com os números do spike da GDELT (ou adiar para depois do lançamento). *Pronto quando* a decisão e os números estão no README.
- [ ] **Resumo semanal por IA** (decidido: semanal, não diário): usa só os dados da semana, cada frase cita a votação de origem e nunca recomenda candidato. *Pronto quando* um verificador automático confere que toda votação e todo número citados existem nos dados, e a chave da API só existe como secret.
- [ ] **Alertas de votações importantes** (decidido: critério de repercussão na imprensa; aviso no app, push opcional). *Pronto quando* a regra tem testes com exemplos reais e o alerta aparece no app.

## 4. Mais dados no crachá

Cada item é uma coleta nova no pipeline (API oficial → modelo → migração → testes com respostas gravadas) e um bloco novo no crachá, sempre com a fonte.

- [ ] **Cota parlamentar** (Câmara: `/deputados/{id}/despesas`; Senado: CEAPS). *Pronto quando* o crachá mostra o total do período e as maiores categorias, com link para cada nota na fonte.
- [ ] **Presença nas sessões** (hoje a grade mostra o registro por votação nominal, não a presença oficial). *Pronto quando* a grade usa a lista de presença publicada por cada casa e o texto explica a diferença.
- [ ] **Proposições e discursos**: quantos projetos apresentou e quantas vezes falou em plenário. *Pronto quando* cada número leva à lista na fonte.
- [ ] **Patrimônio declarado** (TSE, bens de candidato). *Pronto quando* o valor vem da declaração da última eleição, com o ano e o link.
- [ ] **Pauta do plenário**: o que está marcado para votar, não só o que já foi votado. *Pronto quando* a aba Congresso mostra os próximos dias com a fonte de cada casa.
- [ ] **Outros cargos** (governador, deputado estadual, prefeito, vereador): só depois do lançamento; cada assembleia e câmara municipal publica de um jeito.

## 5. Lançamento

- [ ] **Acessibilidade** (WCAG 2.2 AA): teclado, contraste e leitor de tela. *Pronto quando* o axe roda no CI sem erros e o roteiro manual foi feito.
- [ ] **Segurança e privacidade**: cabeçalhos (CSP, Referrer-Policy) e política de privacidade. *Pronto quando* a CSP não usa `unsafe-inline` para scripts e um teste ponta a ponta prova que a colinha não sai do aparelho.
- [ ] **Testes ponta a ponta** (Playwright): início → parlamentar → fonte oficial; colinha: montar → compartilhar → importar. *Pronto quando* rodam no CI contra o build.
- [ ] **Desempenho**: *pronto quando* a página do parlamentar tem LCP abaixo de 2,5 s no perfil móvel do Lighthouse.
- [ ] **Posse da 58ª legislatura** (semana de 01/02): *pronto quando* a coleta e o vínculo pegam os ids novos dos eleitos.
