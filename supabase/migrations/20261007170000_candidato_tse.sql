-- Candidatos do TSE (eleições de 2026): deputados federais e senadores, com a situação
-- da totalização. Fonte: TSE — Portal de Dados Abertos (licença CC-BY: citar "Fonte: TSE").
--
-- Só o necessário para a colinha e o vínculo com Câmara/Senado. O arquivo do TSE também
-- traz CPF, título de eleitor, e-mail, data de nascimento, gênero, cor/raça, estado civil e
-- grau de instrução: nada disso é lido nem gravado aqui.

create table public.candidato_tse (
  sq_candidato             text primary key check (sq_candidato ~ '^[0-9]+$'),  -- código do candidato no TSE
  ano                      smallint not null check (ano between 2018 and 2100),
  cargo                    text not null check (cargo in ('deputado_federal', 'senador')),
  uf                       text not null check (uf ~ '^[A-Z]{2}$'),
  numero                   integer not null check (numero > 0),                 -- número na urna
  nome_urna                text not null,
  nome_civil               text not null,                                       -- para o vínculo com Câmara/Senado
  partido                  text not null,                                       -- sigla
  federacao                text,                                                -- sigla da federação, se houver
  cd_situacao_totalizacao  smallint,                                            -- código do TSE; null = sem totalização (#NULO)
  situacao_totalizacao     text,                                                -- ex.: 'ELEITO POR QP', 'SUPLENTE', 'NÃO ELEITO'
  foto_url                 text,                                                -- preenchida quando as fotos forem importadas
  gerado_em_tse            timestamp not null,                                  -- data/hora de geração do arquivo (Brasília)
  atualizado_em            timestamptz not null default now(),
  check ((cd_situacao_totalizacao is null) = (situacao_totalizacao is null))
);

create index candidato_tse_uf_cargo on public.candidato_tse (uf, cargo);

-- Segurança ------------------------------------------------------------------

alter table public.candidato_tse enable row level security;

create policy candidato_tse_leitura_publica on public.candidato_tse for select to anon, authenticated using (true);

-- Defesa em profundidade: os papéis públicos não têm o privilégio de escrever.
revoke insert, update, delete, truncate on public.candidato_tse from anon, authenticated;
