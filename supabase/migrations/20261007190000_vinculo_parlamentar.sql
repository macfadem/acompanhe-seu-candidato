-- Vínculo candidato do TSE ↔ parlamentar (Câmara/Senado). Fontes: TSE, Câmara e Senado.
-- Automático só por nome civil + UF (sem CPF); o resto é revisado à mão e entra pelo
-- arquivo packages/pipeline/vinculos-manuais.json (revisado em pull request).
--
-- parlamentar_id não tem chave estrangeira: um eleito pode ter id na casa sem ter votado
-- em nenhuma votação já coletada (ex.: ex-deputado que volta em 2027).

create table public.vinculo_parlamentar (
  sq_candidato   text not null references public.candidato_tse (sq_candidato) on delete cascade,
  parlamentar_id text not null check (parlamentar_id ~ '^(camara|senado):[0-9]+$'),
  casa           text not null check (casa in ('camara', 'senado')),
  metodo         text not null check (metodo in ('nome_civil_uf', 'manual')),
  vinculado_em   timestamptz not null default now(),
  primary key (sq_candidato, parlamentar_id),
  check (parlamentar_id like casa || ':%')
);

create index vinculo_parlamentar_parlamentar on public.vinculo_parlamentar (parlamentar_id);

alter table public.vinculo_parlamentar enable row level security;

create policy vinculo_parlamentar_leitura_publica on public.vinculo_parlamentar for select to anon, authenticated using (true);

revoke insert, update, delete, truncate on public.vinculo_parlamentar from anon, authenticated;
