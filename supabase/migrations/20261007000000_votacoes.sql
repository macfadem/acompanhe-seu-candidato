-- Acompanhe Seu Candidato — votações nominais de plenário (Câmara e Senado).
-- Só dados públicos das casas legislativas. Nenhum dado de usuário vive aqui.
-- Leitura pública; escrita apenas pelos jobs com a chave service_role (que ignora RLS
-- e nunca vai para o navegador).

create table public.parlamentar (
  id              text primary key,                   -- 'camara:204480' | 'senado:5672'
  casa            text not null check (casa in ('camara', 'senado')),
  id_casa         text not null,
  nome            text not null,
  partido         text,
  uf              text check (uf ~ '^[A-Z]{2}$'),
  referencia_data date not null,                      -- data da votação de onde vieram nome/partido/UF
  atualizado_em   timestamptz not null default now(),
  unique (casa, id_casa),
  check (id = casa || ':' || id_casa)
);

create table public.votacao (
  id                 text primary key,                -- 'camara:2382675-97' | 'senado:7092'
  casa               text not null check (casa in ('camara', 'senado')),
  id_casa            text not null,
  data               date not null,
  data_hora          timestamp,                       -- horário de Brasília, quando a fonte informa
  orgao              text not null,
  descricao          text not null,
  resultado          text not null check (resultado in ('aprovada', 'rejeitada', 'indefinido')),
  secreta            boolean not null default false,
  nominal            boolean not null,                -- há registro de voto por parlamentar
  proposicao_sigla   text,
  proposicao_numero  text,
  proposicao_ano     integer,
  proposicao_ementa  text,
  proposicao_id_casa text,
  proposicao_url     text,
  placar_sim         integer check (placar_sim >= 0),
  placar_nao         integer check (placar_nao >= 0),
  placar_abstencao   integer check (placar_abstencao >= 0),
  url_fonte          text not null,
  url_api            text not null,
  coletado_em        timestamptz not null default now(),
  unique (casa, id_casa),
  check (id = casa || ':' || id_casa),
  -- Votação aberta com votos individuais sempre tem placar.
  check (not nominal or secreta or (placar_sim is not null and placar_nao is not null and placar_abstencao is not null))
);

create index votacao_data_idx on public.votacao (data desc);
create index votacao_proposicao_idx on public.votacao (casa, proposicao_sigla, proposicao_numero, proposicao_ano);

create table public.voto (
  votacao_id     text not null references public.votacao (id) on delete cascade,
  parlamentar_id text not null references public.parlamentar (id),
  categoria      text not null check (categoria in (
                   'sim', 'nao', 'abstencao', 'obstrucao', 'ausente_justificado',
                   'licenca', 'presente_sem_voto', 'presidente', 'secreto', 'outro')),
  valor_original text not null,                       -- exatamente como veio da fonte
  motivo         text,                                -- motivo oficial da ausência, se houver
  partido        text,                                -- partido na data da votação
  uf             text check (uf ~ '^[A-Z]{2}$'),
  primary key (votacao_id, parlamentar_id)
);

create index voto_parlamentar_idx on public.voto (parlamentar_id);

-- Segurança ------------------------------------------------------------------

alter table public.parlamentar enable row level security;
alter table public.votacao     enable row level security;
alter table public.voto        enable row level security;

create policy parlamentar_leitura_publica on public.parlamentar for select to anon, authenticated using (true);
create policy votacao_leitura_publica     on public.votacao     for select to anon, authenticated using (true);
create policy voto_leitura_publica        on public.voto        for select to anon, authenticated using (true);

-- Defesa em profundidade: mesmo que alguém crie uma política de escrita por engano,
-- os papéis públicos não têm o privilégio de escrever.
revoke insert, update, delete, truncate on public.parlamentar, public.votacao, public.voto from anon, authenticated;
