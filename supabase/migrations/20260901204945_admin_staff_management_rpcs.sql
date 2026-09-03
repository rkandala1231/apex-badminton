-- Staff-management RPCs used by the admin console's "Manage Admins" screen: create a
-- password-only admin/super_admin account, remove one, and list current staff. All three are
-- super_admin-gated internally (raise exception if not public.is_super_admin()) -- the EXECUTE
-- grant below only controls who can attempt the call, not who succeeds.
--
-- Consolidates prod's admin_role_tiers_and_staff_management,
-- restrict_staff_management_rpcs_from_anon, remove_google_switch_to_password_only_admins,
-- provision_password_only_admin_accounts (schema-only; see the note on seed accounts below), and
-- lock_down_staff_management_function_grants migrations into their final state. Written from
-- live introspection of apex-badminton-prod.
--
-- Deliberately NOT included: prod's actual admin accounts (apexadmin, and the staff renamed from
-- admin1/2/3 to real names). This environment gets its own separate dev-only admin account,
-- provisioned by a follow-up statement outside this file -- copying prod's real emails/password
-- hashes into a lower environment would be a credential-hygiene mistake even for a private dev DB.
--
-- Requires 20260901195430_admin_allowlist_and_role_tiers.sql to already be applied (is_admin(),
-- is_super_admin(), and admins.role must exist first).

create or replace function public.create_admin_account(p_email text, p_password text, p_role text default 'admin', p_note text default null)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_email text := lower(trim(p_email));
  v_user_id uuid;
begin
  if not public.is_super_admin() then
    raise exception 'not authorized';
  end if;
  if p_role not in ('admin', 'super_admin') then
    raise exception 'invalid role: %', p_role;
  end if;
  if v_email is null or v_email = '' then
    raise exception 'id is required';
  end if;
  if length(coalesce(p_password, '')) < 8 then
    raise exception 'password must be at least 8 characters';
  end if;
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'an account with this id already exists';
  end if;

  v_user_id := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token,
    is_sso_user, is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
    v_email, crypt(p_password, gen_salt('bf')),
    now(), jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    case when p_note is not null then jsonb_build_object('note', p_note) else '{}'::jsonb end,
    now(), now(),
    '', '', '', '', '', '', '', '',
    false, false
  );

  insert into auth.identities (
    id, provider_id, user_id, identity_data, provider, created_at, updated_at
  ) values (
    gen_random_uuid(), v_user_id::text, v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    'email', now(), now()
  );

  insert into public.admins (user_id, role, note) values (v_user_id, p_role, p_note);
end;
$$;

create or replace function public.remove_admin_access(p_email text)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_email text := lower(trim(p_email));
  v_target_id uuid;
  v_target_is_super boolean;
  v_super_count int;
begin
  if not public.is_super_admin() then
    raise exception 'not authorized';
  end if;

  select au.id into v_target_id from auth.users au where lower(au.email) = v_email;
  if v_target_id is null then
    raise exception 'no such account';
  end if;

  select (a.role = 'super_admin') into v_target_is_super
  from public.admins a where a.user_id = v_target_id;

  if v_target_is_super then
    select count(*) into v_super_count from public.admins where role = 'super_admin';
    if v_super_count <= 1 then
      raise exception 'cannot remove the last super admin';
    end if;
  end if;

  delete from public.admins where user_id = v_target_id;
  delete from auth.identities where user_id = v_target_id;
  delete from auth.users where id = v_target_id;
end;
$$;

create or replace function public.list_admin_staff()
returns table (email text, role text, note text, since timestamptz)
language plpgsql
stable
security definer
set search_path = 'public'
as $$
begin
  if not public.is_super_admin() then
    raise exception 'not authorized';
  end if;
  return query
    select au.email::text, a.role, a.note, a.created_at
    from public.admins a
    join auth.users au on au.id = a.user_id
    order by a.created_at desc;
end;
$$;

revoke execute on function public.create_admin_account(text, text, text, text) from public;
revoke execute on function public.remove_admin_access(text) from public;
revoke execute on function public.list_admin_staff() from public;
grant execute on function public.create_admin_account(text, text, text, text) to authenticated;
grant execute on function public.remove_admin_access(text) to authenticated;
grant execute on function public.list_admin_staff() to authenticated;
