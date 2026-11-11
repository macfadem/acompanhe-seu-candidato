# Roteiro até o lançamento

Meta: site no ar até **01/02/2027**, quando toma posse a 58ª legislatura — a partir daí, quem montou a colinha acompanha os eleitos.

Cada item cabe numa sessão de trabalho e vira uma branch + pull request. **Pronto quando** é o critério de aceite: o que precisa ser verdade e como conferir.

## Feito

- Coleta das votações nominais de plenário (Câmara e Senado), banco com RLS, candidatos do TSE 2026 e vínculo com a Câmara e o Senado.
- Núcleo da colinha (`packages/colinha`) e spike de notícias (GDELT).
- Começo do site (`packages/app`): página do parlamentar com os votos, a legenda e a fonte oficial; dados de exemplo; testes e build no CI.

## 1. O site lendo dados reais

- [ ] **Projeto no Supabase** (manual): criar o projeto e cadastrar os secrets, como no README. *Pronto quando* a coleta diária grava no banco.
- [ ] **Fonte do Supabase**: implementar `FonteDeDados` (`packages/app/src/fontes/modelo.ts`) lendo `parlamentar`, `votacao` e `voto` com a chave pública (anon) e o RLS. *Pronto quando* `SUPABASE_URL` e `SUPABASE_ANON_KEY` trocam a fonte sem mudar nenhuma página; os testes usam respostas gravadas, sem rede; nenhuma chave `service_role` chega ao site.
- [ ] **Atualização sem novo deploy**: páginas em cache, revalidadas depois da coleta diária. *Pronto quando* um voto novo no banco aparece no site no mesmo dia, sem deploy.
- [ ] **Página da votação** (`/votacao/[casa]/[idCasa]`): descrição, ementa, resultado e os votos de todos, agrupados por registro. *Pronto quando* cada voto da página do parlamentar leva à votação, id inválido dá 404 e o agrupamento tem teste.
- [ ] **Busca de parlamentar** por nome (com ou sem acento), UF e partido. *Pronto quando* "joao" encontra "João", a busca funciona sem JavaScript (formulário GET) e a normalização tem testes.
- [ ] **Paginação dos votos** (hoje a página mostra os 50 mais recentes). *Pronto quando* há anterior/próxima com o total certo e o recorte tem teste.
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

## 4. Lançamento

- [ ] **Acessibilidade** (WCAG 2.2 AA): teclado, contraste e leitor de tela. *Pronto quando* o axe roda no CI sem erros e o roteiro manual foi feito.
- [ ] **Segurança e privacidade**: cabeçalhos (CSP, Referrer-Policy) e política de privacidade. *Pronto quando* a CSP não usa `unsafe-inline` para scripts e um teste ponta a ponta prova que a colinha não sai do aparelho.
- [ ] **Testes ponta a ponta** (Playwright): início → parlamentar → fonte oficial; colinha: montar → compartilhar → importar. *Pronto quando* rodam no CI contra o build.
- [ ] **Desempenho**: *pronto quando* a página do parlamentar tem LCP abaixo de 2,5 s no perfil móvel do Lighthouse.
- [ ] **Posse da 58ª legislatura** (semana de 01/02): *pronto quando* a coleta e o vínculo pegam os ids novos dos eleitos.
