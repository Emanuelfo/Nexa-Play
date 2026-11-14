-- db/migrations/20261114_login_google.sql — Login com Google (Nexa Quest)
-- Executar no SQL Editor do Supabase (nexaplay-dev e depois nexaplay-prod) ANTES de publicar o backend novo.
-- Idempotente e não destrutivo: nenhum usuário, senha ou dado existente é alterado ou removido.
--
-- O que muda em "usuarios":
--   * senha passa a aceitar NULL (contas criadas pelo Google não têm senha local);
--   * google_sub: identificador externo ("sub") da conta Google, único no sistema;
--   * google_vinculado_em: quando o Google foi vinculado à conta;
--   * constraint: toda conta precisa ter ao menos um método de login (senha OU google_sub).
--
-- Reversão (somente se NENHUMA conta Google-only existir, ou seja, se não houver senha nula):
--   alter table usuarios drop constraint usuarios_metodo_login_chk;
--   drop index uq_usuarios_google_sub;
--   alter table usuarios drop column google_sub, drop column google_vinculado_em;
--   alter table usuarios alter column senha set not null;

begin;

alter table usuarios alter column senha drop not null;

alter table usuarios
  add column if not exists google_sub varchar(255),
  add column if not exists google_vinculado_em timestamptz;

-- Único (valores NULL não colidem entre si no Postgres): impede duas contas com o mesmo Google,
-- inclusive em requisições simultâneas.
create unique index if not exists uq_usuarios_google_sub on usuarios (google_sub);

do $$
begin
  if not exists (select 1 from pg_constraint
                 where conname = 'usuarios_metodo_login_chk'
                   and conrelid = 'usuarios'::regclass) then
    alter table usuarios
      add constraint usuarios_metodo_login_chk
      check (senha is not null or google_sub is not null);
  end if;
end $$;

commit;
