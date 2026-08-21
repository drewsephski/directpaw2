alter table sitters
  add column if not exists email_verified boolean not null default false,
  add column if not exists image text,
  add column if not exists updated_at timestamptz not null default now(),
  alter column password_hash drop not null;

create table if not exists auth_accounts (
  id uuid primary key default gen_random_uuid(),
  issuer text not null,
  account_id text not null,
  provider_id text not null,
  user_id uuid not null references sitters(id) on delete cascade,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (issuer, account_id)
);
create index if not exists auth_accounts_user_idx on auth_accounts(user_id);

insert into auth_accounts (issuer, account_id, provider_id, user_id, password)
select 'local:credential', id::text, 'credential', id, password_hash
from sitters
where password_hash is not null
on conflict (issuer, account_id) do nothing;

create table if not exists auth_sessions (
  id uuid primary key default gen_random_uuid(),
  expires_at timestamptz not null,
  token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  user_id uuid not null references sitters(id) on delete cascade
);
create index if not exists auth_sessions_user_idx on auth_sessions(user_id);

create table if not exists auth_verifications (
  id uuid primary key default gen_random_uuid(),
  identifier text not null,
  value text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists auth_verifications_identifier_idx on auth_verifications(identifier);

create table if not exists auth_rate_limits (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  count integer not null,
  last_request bigint not null
);

delete from sitter_sessions;
