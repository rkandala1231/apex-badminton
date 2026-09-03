-- qa-schema counterpart of 20260901195430_admin_allowlist_and_role_tiers.sql.
-- See that file for full context. Same idempotent-against-an-older-admins-table approach;
-- everything schema-qualified `qa.` instead of `public.`. `qa.admins` already exists (dev/qa's
-- original baseline created it) with the same pre-role-tier shape as `public.admins` did.

alter table qa.admins add column if not exists role text not null default 'admin';
alter table qa.admins add column if not exists note text;
do $$ begin
  alter table qa.admins add constraint admins_role_check check (role in ('admin', 'super_admin'));
exception when duplicate_object then null;
end $$;

create table if not exists qa.admin_allowlist (
  email text primary key,
  note text,
  added_at timestamptz not null default now(),
  role text not null default 'admin' check (role in ('admin', 'super_admin'))
);

alter table qa.admins enable row level security;
alter table qa.admin_allowlist enable row level security;

drop policy if exists "admins can select admins" on qa.admins;

create or replace function qa.is_admin()
returns boolean
language sql
stable
security definer
set search_path = 'qa'
as $$
  select
    exists (
      select 1
      from qa.admins a
      join auth.users au on au.id = a.user_id
      where a.user_id = (select auth.uid())
         or (
           au.email_confirmed_at is not null
           and au.email = (select auth.jwt() ->> 'email')
         )
    )
    or exists (
      select 1
      from qa.admin_allowlist al
      where lower(al.email) = lower((select auth.jwt() ->> 'email'))
    );
$$;

create or replace function qa.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = 'qa'
as $$
  select
    exists (
      select 1
      from qa.admins a
      join auth.users au on au.id = a.user_id
      where a.role = 'super_admin'
        and (
          a.user_id = (select auth.uid())
          or (
            au.email_confirmed_at is not null
            and au.email = (select auth.jwt() ->> 'email')
          )
        )
    )
    or exists (
      select 1
      from qa.admin_allowlist al
      where al.role = 'super_admin'
        and lower(al.email) = lower((select auth.jwt() ->> 'email'))
    );
$$;

revoke execute on function qa.is_admin() from public;
revoke execute on function qa.is_super_admin() from public;
grant execute on function qa.is_admin() to authenticated;
grant execute on function qa.is_super_admin() to authenticated;
