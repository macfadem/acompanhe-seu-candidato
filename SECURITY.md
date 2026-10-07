# Segurança

Encontrou uma falha? Não abra issue pública: use **Security → Report a vulnerability** neste repositório (aviso privado do GitHub).

Princípios do projeto:

- Em quem a pessoa votou é dado sensível (LGPD, art. 5º, II) e **nunca sai do aparelho**: nada de conta, cookies de rastreamento, gravação de sessão, colinha em URL com `?` ou em logs.
- O banco guarda só dados públicos das casas legislativas e do TSE. Leitura pública; escrita só pelos jobs.
- Chaves ficam em variáveis de ambiente e em GitHub Secrets — nunca no código.
