-- db/schema.sql — Nexa Play / Nexa Quest (Supabase / Postgres)
-- Executar no SQL Editor do Supabase (nexaplay-dev e depois nexaplay-prod).
-- Regras: snake_case, identity bigint, timestamptz, índice em toda FK, RLS ligado sem policies.
-- Idempotente: pode rodar em banco vazio ou em banco que já tenha as tabelas (sem DROP/TRUNCATE).

begin;

-- =========================================================
-- 1) Funções
-- =========================================================
create or replace function set_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

-- =========================================================
-- 2) Usuários e autenticação
-- =========================================================
create table if not exists usuarios (
  id             bigint generated always as identity primary key,
  nome_usuario   varchar(100) not null,
  email          varchar(255) not null unique,          -- e-mail normalizado (minúsculas, sem espaços)
  senha          varchar(255) not null,                 -- hash bcrypt
  pontos         integer not null default 0 check (pontos >= 0),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

alter table usuarios
  add column if not exists nome_exibicao varchar(100),
  add column if not exists biografia text not null default '',
  add column if not exists avatar_url text,
  add column if not exists capa_url text,
  add column if not exists perfil_publico boolean not null default true,
  add column if not exists mostrar_biografia boolean not null default true,
  add column if not exists mostrar_pontos boolean not null default true,
  add column if not exists mostrar_amigos boolean not null default true,
  add column if not exists mostrar_conquistas boolean not null default true,
  add column if not exists mostrar_progresso boolean not null default true;

update usuarios
set nome_exibicao = nome_usuario,
    nome_usuario = coalesce(
      nullif(btrim(left(regexp_replace(lower(nome_usuario), '[^a-z0-9]+', '-', 'g'), 20), '-'), ''),
      'jogador'
    ) || '-' || id::text
where nome_exibicao is null;

alter table usuarios alter column nome_exibicao set not null;
create unique index if not exists uq_usuarios_nome_usuario_lower
  on usuarios (lower(nome_usuario));

create table if not exists amizades (
  id              bigint generated always as identity primary key,
  solicitante_id  bigint not null references usuarios(id) on delete cascade,
  destinatario_id bigint not null references usuarios(id) on delete cascade,
  status          varchar(20) not null default 'pendente'
                  check (status in ('pendente', 'aceita')),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  check (solicitante_id <> destinatario_id)
);
create unique index if not exists uq_amizades_par
  on amizades (least(solicitante_id, destinatario_id), greatest(solicitante_id, destinatario_id));
create index if not exists idx_amizades_destinatario_status
  on amizades (destinatario_id, status);
create index if not exists idx_amizades_solicitante_status
  on amizades (solicitante_id, status);

create table if not exists mensagens (
  id          bigint generated always as identity primary key,
  nome        varchar(100) not null,
  email       varchar(255) not null,
  assunto     varchar(150) not null,
  texto       text not null,
  usuario_id  bigint references usuarios(id) on delete set null,
  criado_em   timestamptz not null default now()
);
create index if not exists idx_mensagens_usuario_id on mensagens(usuario_id);

create table if not exists redefinicoes_senha (
  id          bigint generated always as identity primary key,
  usuario_id  bigint not null references usuarios(id) on delete cascade,
  token_hash  varchar(64) not null unique,              -- SHA-256 em hex (64 caracteres)
  expira_em   timestamptz not null,
  usado_em    timestamptz,
  criado_em   timestamptz not null default now()
);
create index if not exists idx_redefinicoes_senha_usuario_id on redefinicoes_senha(usuario_id);

-- =========================================================
-- 3) Conteúdo (cadastrado por você)
-- =========================================================
create table if not exists trilhas (
  id         bigint generated always as identity primary key,
  titulo     varchar(150) not null,
  descricao  text,
  ordem      integer not null default 0
);

create table if not exists atividades (
  id            bigint generated always as identity primary key,
  trilha_id     bigint not null references trilhas(id),
  tipo          varchar(20) not null check (tipo in ('missao','desafio','conteudo')),
  titulo        varchar(150) not null,
  descricao     text,
  pontos        integer not null default 0 check (pontos >= 0),
  ordem         integer not null default 0,
  nivel_minimo  integer not null default 1 check (nivel_minimo >= 1)
);
create index if not exists idx_atividades_trilha_id on atividades(trilha_id);

create table if not exists conquistas (
  id         bigint generated always as identity primary key,
  titulo     varchar(150) not null,
  descricao  text,
  icone      varchar(255)
);

-- =========================================================
-- 4) Progresso (site + jogo)
-- =========================================================
create table if not exists progresso_usuario (
  usuario_id    bigint not null references usuarios(id) on delete cascade,
  atividade_id  bigint not null references atividades(id) on delete cascade,
  status        varchar(20) not null check (status in ('em_andamento','concluida')),
  pontuacao     integer not null default 0 check (pontuacao >= 0),
  concluida_em  timestamptz,
  primary key (usuario_id, atividade_id)
);
create index if not exists idx_progresso_atividade_id on progresso_usuario(atividade_id);

create table if not exists usuario_conquistas (
  usuario_id    bigint not null references usuarios(id) on delete cascade,
  conquista_id  bigint not null references conquistas(id) on delete cascade,
  obtida_em     timestamptz not null default now(),
  primary key (usuario_id, conquista_id)
);
create index if not exists idx_usuario_conquistas_conquista_id on usuario_conquistas(conquista_id);

-- =========================================================
-- 5) Comunidade
-- =========================================================
create table if not exists publicacoes (
  id            bigint generated always as identity primary key,
  usuario_id    bigint not null references usuarios(id) on delete cascade,
  texto         text not null,
  conquista_id  bigint references conquistas(id) on delete set null,
  oculta        boolean not null default false,
  criado_em     timestamptz not null default now()
);
create index if not exists idx_publicacoes_usuario_id on publicacoes(usuario_id);
create index if not exists idx_publicacoes_conquista_id on publicacoes(conquista_id);

create table if not exists comentarios (
  id             bigint generated always as identity primary key,
  publicacao_id  bigint not null references publicacoes(id) on delete cascade,
  usuario_id     bigint not null references usuarios(id) on delete cascade,
  texto          text not null,
  oculta         boolean not null default false,
  criado_em      timestamptz not null default now()
);
create index if not exists idx_comentarios_publicacao_id on comentarios(publicacao_id);
create index if not exists idx_comentarios_usuario_id on comentarios(usuario_id);

create table if not exists curtidas (
  publicacao_id  bigint not null references publicacoes(id) on delete cascade,
  usuario_id     bigint not null references usuarios(id) on delete cascade,
  criado_em      timestamptz not null default now(),
  primary key (publicacao_id, usuario_id)
);
create index if not exists idx_curtidas_usuario_id on curtidas(usuario_id);

-- =========================================================
-- 6) Projetos públicos e colaboração
-- =========================================================
create table if not exists projetos (
  id              bigint generated always as identity primary key,
  proprietario_id bigint not null references usuarios(id) on delete cascade,
  titulo          varchar(120) not null,
  descricao       text not null,
  imagem_url      text,
  categoria       varchar(80) not null,
  link_externo    text,
  visibilidade    varchar(10) not null default 'publico'
                  check (visibilidade in ('publico','privado')),
  tipo            varchar(10) not null default 'individual'
                  check (tipo in ('individual','equipe')),
  criado_em       timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create index if not exists idx_projetos_publicos_data
  on projetos (criado_em desc, id desc) where visibilidade = 'publico';
create index if not exists idx_projetos_proprietario_data
  on projetos (proprietario_id, id desc);
create index if not exists idx_projetos_categoria
  on projetos (categoria, id desc);

create table if not exists projeto_participantes (
  id              bigint generated always as identity primary key,
  projeto_id      bigint not null references projetos(id) on delete cascade,
  usuario_id      bigint not null references usuarios(id) on delete cascade,
  origem          varchar(12) not null check (origem in ('convite','solicitacao')),
  status          varchar(12) not null default 'pendente'
                  check (status in ('pendente','aceito','recusado')),
  criado_em       timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (projeto_id, usuario_id)
);
create index if not exists idx_projeto_participantes_usuario_status
  on projeto_participantes (usuario_id, status);
create index if not exists idx_projeto_participantes_projeto_status
  on projeto_participantes (projeto_id, status);

create table if not exists projeto_atualizacoes (
  id          bigint generated always as identity primary key,
  projeto_id  bigint not null references projetos(id) on delete cascade,
  autor_id    bigint not null references usuarios(id) on delete cascade,
  texto       text not null,
  criado_em   timestamptz not null default now()
);
create index if not exists idx_projeto_atualizacoes_projeto_data
  on projeto_atualizacoes (projeto_id, id desc);

-- Buckets compartilhados de rate limiting; as chaves persistidas são hashes,
-- nunca endereços IP, nomes de usuário ou IDs em texto claro.
create table if not exists public.api_rate_limit_windows (
  bucket_key char(64) primary key,
  hit_count   integer not null check (hit_count > 0),
  reset_at    timestamptz not null
);
create index if not exists idx_api_rate_limit_windows_reset_at
  on public.api_rate_limit_windows (reset_at);

-- =========================================================
-- 7) Ajustes idempotentes (úteis se as tabelas já existiam de uma execução anterior)
-- =========================================================

-- 6.1) token_hash: char(64) -> varchar(64) (no-op se já for varchar(64))
alter table redefinicoes_senha alter column token_hash type varchar(64);

-- 6.2) token_hash deve ser um SHA-256 em hexadecimal minúsculo
do $$
begin
  if not exists (select 1 from pg_constraint
                 where conname = 'redefinicoes_senha_token_hash_formato_chk'
                   and conrelid = 'redefinicoes_senha'::regclass) then
    alter table redefinicoes_senha
      add constraint redefinicoes_senha_token_hash_formato_chk
      check (token_hash ~ '^[0-9a-f]{64}$');
  end if;
end $$;

-- 6.3) contato: e-mail já normalizado (minúsculas, sem espaços, formato básico de e-mail)
--      A normalização (lower + trim) é feita pela aplicação ANTES do INSERT/UPDATE;
--      o CHECK rejeita no banco qualquer valor que não esteja normalizado.
do $$
begin
  if not exists (select 1 from pg_constraint
                 where conname = 'usuarios_email_normalizado_chk'
                   and conrelid = 'usuarios'::regclass) then
    alter table usuarios
      add constraint usuarios_email_normalizado_chk
      check (
        email = lower(btrim(email))
        and email !~ '[[:space:]]'
        and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
      );
  end if;
end $$;

-- 6.4) Renomeia o índice antigo de progresso_usuario(atividade_id), se existir
do $$
begin
  if to_regclass('public.idx_progresso_usuario_atividade_id') is not null
     and to_regclass('public.idx_progresso_atividade_id') is not null then
    -- os dois existem (índice duplicado): remove só o antigo, o novo cobre a mesma coluna
    drop index public.idx_progresso_usuario_atividade_id;
  elsif to_regclass('public.idx_progresso_usuario_atividade_id') is not null then
    alter index public.idx_progresso_usuario_atividade_id rename to idx_progresso_atividade_id;
  end if;
end $$;

-- =========================================================
-- 8) Triggers de atualizado_em
-- =========================================================
create or replace trigger trg_usuarios_atualizado_em
  before update on usuarios
  for each row
  execute function set_atualizado_em();

  create or replace trigger trg_projetos_atualizado_em
    before update on projetos
    for each row
    execute function set_atualizado_em();

  create or replace trigger trg_projeto_participantes_atualizado_em
    before update on projeto_participantes
    for each row
    execute function set_atualizado_em();

  -- =========================================================
  -- 9) RLS ligado em todas as tabelas, SEM policies e SEM FORCE
--    (o backend usa DATABASE_URL no servidor e pode ignorar RLS; a API pública fica sem policies)
-- =========================================================
alter table usuarios            enable row level security;
alter table amizades            enable row level security;
alter table mensagens           enable row level security;
alter table redefinicoes_senha  enable row level security;
alter table trilhas             enable row level security;
alter table atividades          enable row level security;
alter table conquistas          enable row level security;
alter table progresso_usuario   enable row level security;
alter table usuario_conquistas  enable row level security;
alter table publicacoes         enable row level security;
alter table comentarios         enable row level security;
alter table curtidas            enable row level security;
alter table projetos            enable row level security;
alter table projeto_participantes enable row level security;
alter table projeto_atualizacoes enable row level security;
alter table public.api_rate_limit_windows enable row level security;

commit;