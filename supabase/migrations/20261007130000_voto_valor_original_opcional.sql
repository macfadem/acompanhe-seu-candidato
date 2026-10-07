-- Na Câmara, votação secreta vem com tipoVoto null para todos os participantes
-- (ex.: PDL 995/2026, escolha de ministro do TCU, 02/09/2026). Só a participação é pública.
-- O valor original passa a aceitar null = "a fonte não informou".
alter table public.voto alter column valor_original drop not null;

comment on column public.voto.valor_original is
  'Exatamente como veio da fonte; null quando a fonte não informa (ex.: votação secreta na Câmara).';
