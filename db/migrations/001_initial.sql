create extension if not exists pgcrypto;
create table if not exists sitters (
  id uuid primary key default gen_random_uuid(), email text not null unique, business_name text not null,
  password_hash text not null, stripe_account_id text unique, stripe_ready boolean not null default false,
  created_at timestamptz not null default now(), constraint sitter_email_normalized check (email = lower(email)),
  constraint sitter_business_name_length check (char_length(business_name) between 2 and 100)
);
create table if not exists sitter_sessions (
  id uuid primary key default gen_random_uuid(), sitter_id uuid not null references sitters(id) on delete cascade,
  token_hash text not null unique, expires_at timestamptz not null, created_at timestamptz not null default now()
);
create index if not exists sitter_sessions_lookup_idx on sitter_sessions(token_hash, expires_at);
create table if not exists payment_requests (
  id uuid primary key default gen_random_uuid(), sitter_id uuid not null references sitters(id) on delete cascade,
  public_token text not null unique, amount_cents integer not null check (amount_cents between 100 and 1000000),
  description text not null check (char_length(description) between 3 and 200), client_email text,
  status text not null default 'open' check (status in ('open', 'paid', 'refunded', 'disputed')),
  stripe_checkout_session_id text unique, stripe_payment_intent_id text, paid_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists payment_requests_sitter_idx on payment_requests(sitter_id, created_at desc);
create table if not exists stripe_webhook_events (
  event_id text primary key, event_type text not null, processed_at timestamptz not null default now()
);
