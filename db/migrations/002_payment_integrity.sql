alter table payment_requests
  add column if not exists platform_fee_cents integer,
  add column if not exists refunded_amount_cents integer not null default 0,
  add column if not exists application_fee_refunded_cents integer not null default 0,
  add column if not exists stripe_charge_id text,
  add column if not exists stripe_application_fee_id text,
  add column if not exists currency text not null default 'usd';
update payment_requests set platform_fee_cents = round(amount_cents * 0.03)::integer where platform_fee_cents is null;
alter table payment_requests alter column platform_fee_cents set not null;
alter table payment_requests drop constraint if exists payment_requests_status_check;
alter table payment_requests add constraint payment_requests_status_check check (status in ('open', 'paid', 'partially_refunded', 'refunded', 'disputed', 'chargeback'));
alter table payment_requests add constraint payment_requests_platform_fee_check check (platform_fee_cents > 0 and platform_fee_cents < amount_cents);
alter table payment_requests add constraint payment_requests_refunded_amount_check check (refunded_amount_cents >= 0 and refunded_amount_cents <= amount_cents);
alter table payment_requests add constraint payment_requests_application_fee_refunded_check check (application_fee_refunded_cents >= 0 and application_fee_refunded_cents <= platform_fee_cents);
alter table payment_requests add constraint payment_requests_currency_check check (currency = lower(currency) and char_length(currency) = 3);
create unique index if not exists payment_requests_charge_idx on payment_requests(stripe_charge_id) where stripe_charge_id is not null;
create unique index if not exists payment_requests_application_fee_idx on payment_requests(stripe_application_fee_id) where stripe_application_fee_id is not null;
