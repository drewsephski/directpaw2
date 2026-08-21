do $$
begin
  if exists (
    select 1 from sitters s
    where s.password_hash is not null
      and not exists (
        select 1 from auth_accounts a
        where a.user_id = s.id
          and a.provider_id = 'credential'
          and a.issuer = 'local:credential'
          and a.account_id = s.id::text
          and a.password is not null
      )
  ) then
    raise exception 'Legacy credential cleanup blocked: a sitter password has no matching Better Auth credential account';
  end if;
end $$;

drop table if exists sitter_sessions;
alter table sitters drop column if exists password_hash;
