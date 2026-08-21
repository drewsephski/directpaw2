# DirectPaw

DirectPaw is a deliberately small payment-request app for independent US pet sitters. A sitter creates a link, the pet owner pays through Stripe-hosted Checkout, and the charge is created directly on the sitter's connected Stripe account. DirectPaw receives the immutable 3% application fee stored with that request.

```text
Pet owner -> Stripe Checkout -> sitter connected account -> sitter payout
                                  |
                                  +-> 3% application fee -> DirectPaw
```

The sitter is the merchant of record. Stripe collects its processing fees from the sitter, owns connected-account negative-balance liability, handles card data and payouts, and provides the sitter's full Stripe Dashboard. DirectPaw never holds or manually pays out sitter funds.

## Stack and prerequisites

- Next.js App Router, TypeScript, Bun, Better Auth, `postgres.js`, PostgreSQL, and `stripe-node`
- A Stripe Connect platform with Accounts v2 access
- Node 18+ where Bun is not providing the runtime
- A PostgreSQL database with permission to create tables, indexes, constraints, and `pgcrypto`

Stripe documents Accounts v2 as generally available for Connect. DirectPaw also uses the Account Links v2 endpoint documented for the stable `2026-07-29.dahlia` API version; preview programs that can be represented by Accounts v2 are separate from DirectPaw's merchant-account use case.

Connected accounts are created with `configuration.merchant`, `dashboard: "full"`, `fees_collector: "stripe"`, `losses_collector: "stripe"`, and an requested card-payments capability. Stripe-hosted onboarding collects `eventually_due` requirements. DirectPaw revalidates `configuration.merchant.capabilities.card_payments.status === "active"` before creating a request or Checkout Session.

## Configuration

Copy `.env.example` to `.env.local` and set:

- `DATABASE_URL`: PostgreSQL connection string.
- `BETTER_AUTH_SECRET`: random secret of at least 32 characters. Generate it with `openssl rand -base64 32` and keep it stable and private in each environment.
- `BETTER_AUTH_URL`: the canonical application origin for Better Auth, origin checks, Stripe onboarding callbacks, and Checkout return URLs. A trailing slash is normalized; use `http://localhost:4242` locally and an HTTPS origin in production.
- `STRIPE_SECRET_KEY`: server-side Stripe key. Prefer a restricted `rk_` key.
- `STRIPE_WEBHOOK_SECRET`: signing secret for this endpoint, not an API key.

`DOMAIN` is accepted only as a deprecated compatibility fallback for existing local environments. New environments must set `BETTER_AUTH_URL`; production rejects a non-HTTPS origin.

The finished code needs these restricted-key permissions, including connected-account access where Stripe offers that scope:

- Connected Accounts: read and write
- Account Links: write
- Checkout Sessions: read and write
- PaymentIntents: read
- Charges and Refunds: read
- Disputes: read
- Application Fees: read and write (write is required to refund DirectPaw's fee)

Accounts v2 permission names and availability can depend on platform enrollment. Test the restricted key against onboarding, Checkout, refunds, and webhook reconciliation before replacing a sandbox secret key.

## Run locally

```bash
bun install --frozen-lockfile
bun run db:migrate
bun run dev
```

Migrations are SQL files in `db/migrations`, applied in lexical order, and recorded in `schema_migrations`. The runner uses a PostgreSQL advisory lock and each new migration runs transactionally, so rerunning it is safe. Never edit an applied migration; add the next numbered file.

Better Auth `1.7.1` provides email/password sign-up, sign-in, database sessions, secure HTTP-only cookies, origin checks, and database-backed rate limiting. It maps its user model to `sitters` and its account, session, verification, and rate-limit models to the `auth_*` tables. Migration `003` keeps existing sitter IDs and salted-scrypt passwords by moving credential hashes into Better Auth accounts; migration `004` fails closed unless every legacy hash has a matching `local:credential` account, then removes `sitters.password_hash` and `sitter_sessions`. Email verification and password reset remain intentionally unavailable until DirectPaw has a transactional email provider.

CI starts a fresh PostgreSQL service, applies every SQL migration, and exercises Better Auth's real handler against that database. The smoke test covers mixed-case email sign-up, credential identity and password placement, sign-in, session resolution, sign-out invalidation, and database-backed client rate limiting.

## Stripe webhook testing

The production event destination must be configured to **listen to events on connected accounts**, use webhook API version `2026-07-29.dahlia`, and send exactly:

- `checkout.session.completed`
- `charge.refunded`
- `charge.dispute.created`
- `charge.dispute.closed`

For local forwarding, authenticate the Stripe CLI, then run:

```bash
stripe listen \
  --events checkout.session.completed,charge.refunded,charge.dispute.created,charge.dispute.closed \
  --forward-connect-to localhost:4242/api/webhook
```

Put the printed `whsec_...` value in `STRIPE_WEBHOOK_SECRET` and restart the app. Use a connected test account with active card payments. Checkout is intentionally constrained to cards and card-backed wallets; DirectPaw v1 has no asynchronous bank-payment states.

## Payment integrity

- Amount and 3% fee come from PostgreSQL, never the browser. Existing requests are backfilled when migration `002` is applied.
- Checkout is a direct charge using the sitter's connected-account request context.
- Each payment request has one canonical Checkout Session. Creation is serialized with a PostgreSQL transaction lock, uses a deterministic Stripe idempotency key, and stores the Session before redirecting. An open Session is reused; a completed paid Session blocks a second Checkout while the webhook catches up; an expired Session gets one deterministic replacement.
- Checkout Session, PaymentIntent, and Charge identifiers are reconciled against request metadata, sitter account, amount, and USD currency.
- The success page validates the paid Checkout Session, including its canonical stored ID when present, but never changes persistence. Only the signed webhook does that.
- Webhooks tolerate duplicate Event objects and out-of-order completion, refund, and dispute delivery.
- Partial refunds are explicit. DirectPaw refunds its application fee to the same cumulative proportion; a complete charge refund targets the entire platform fee.
- Disputes become `disputed`; a won closure restores paid/refund state and a lost closure becomes `chargeback`. The sitter handles evidence in Stripe's full Dashboard.

## Verification and manual matrix

```bash
bun run lint
bun run typecheck
bun test
bun run build
```

Before launch, perform these in one Stripe sandbox and confirm both Stripe accounts and PostgreSQL after every step:

| Case | Expected result |
| --- | --- |
| Normal card payment | Charge is on sitter; 3% fee is on DirectPaw; webhook marks paid |
| Direct success-URL navigation | Page says payment is not confirmed; database remains unchanged |
| Duplicate or concurrent Checkout submission | The canonical open Session is reused; stable idempotency converges creation or expired-Session replacement |
| Partial refund in sitter Dashboard | Request becomes partially refunded; platform fee reaches the proportional cumulative target |
| Full refund | Request becomes refunded; Stripe application fee is fully refunded |
| Dispute opened / won / lost | Request becomes disputed, then restores payment/refund state if won or becomes chargeback if lost |

Code checks and simulated unit tests do not prove Connect onboarding, settlement, application-fee transfer/refund, webhook delivery, or payout behavior. Those require the sandbox flow above before live mode.
