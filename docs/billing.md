# Billing

SalatHub is sold per masjid on two plans, Free and Pro, billed yearly through Stripe. The database is the source of truth for what a masjid may do; Stripe only collects money and reports back through a webhook. The Alkhairia app is free and never shows prices, payment links or upgrade prompts, and neither does the TV app.

## How a masjid's plan is decided

`masjid_billing` holds one row per masjid: `plan` (`free` or `pro`) and a `status` that says why. What each plan allows lives in one place, `plan_rules` (screens included, active-announcement limit, feature keys); the console, the display payload and the limit triggers all read it. See [Database](./database.md) for the functions.

| Status           | Plan | How it starts                                | How it ends                                    |
| ---------------- | ---- | -------------------------------------------- | ---------------------------------------------- |
| `trial`          | Pro  | Every new masjid, 30 days, no card           | `expire_masjid_billing()` moves it to Free     |
| `granted`        | Pro  | A platform admin's grant, or the launch one  | Same job, at `granted_until`                   |
| `active`         | Pro  | A paid Stripe subscription                   | The webhook                                    |
| `cancelled`      | Pro  | Cancelled in the portal, runs to `renews_at` | The webhook, when Stripe ends the subscription |
| `payment_failed` | Pro  | A renewal that didn't charge                 | Free once `grace_ends_at` passes (14 days)     |
| `none`           | Free | Any of the above ending                      | An upgrade or a grant                          |

Only server-side code writes `masjid_billing`. Masjid admins and platform admins read it; moderators can't.

## Stripe configuration the code relies on

These live in Stripe, not in the repo, so changing them in the dashboard changes behaviour. The sandbox (`acct_1UaA7KBuq4n8PSZx`) is set up this way; the live account must match.

- **One tiered price, billed per screen.** Pro is a single yearly graduated price: screens 1–5 together cost a flat fee, and each screen from the 6th is added per screen. The subscription's quantity is the total number of screens. A separate "extra screen" product won't work: Stripe's portal can't change quantities on a subscription with two products.
- **Prices are found by lookup key, never by id.** Checkout uses `salathub_pro_yearly` (`PRO_PRICE_LOOKUP_KEY` in `supabase/functions/_shared/stripe.ts`). The regular extra-screen price sits inactive under `salathub_pro_yearly_regular`; withdrawing the launch price means activating it and transferring the `salathub_pro_yearly` key to it. Masjids that bought at the launch price keep it at renewal.
- **Currencies.** Each price carries USD, CAD and PKR. A masjid's currency comes from its timezone (`billing_currency_for_timezone()`) and is fixed once it has a Stripe customer, because Stripe locks a customer's currency.
- **Customer portal.** The default configuration allows card updates, invoices, name/email/address/tax ID, cancelling at the end of the period, and changing the screen quantity from 5 to 99 with pro-rata charges invoiced at once.
- **Managed Payments stays off.** The account has it on by default; Checkout turns it off for each session (`managed_payments: { enabled: false }` in the `billing` function), because it rejects our Terms checkbox and auto-renewal wording and would make Stripe the seller.
- **Stripe Tax.** Checkout enables automatic tax and requires a billing address. Stripe charges tax only where a registration exists in the dashboard, so registrations decide where tax applies (PB-96, PB-97).
- **Retries and emails.** Smart Retries try a failed renewal up to 8 times in 2 weeks, then cancel the subscription, which lines up with the 14-day grace period. Failed-payment, expiring-card, 30-day renewal and bank-confirmation emails come from Stripe.
- **Webhook.** One endpoint pointing at `stripe-webhook`, sending `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed` and `customer.updated`.

## Edge Functions

| Function         | Called by                 | Does                                                                                           |
| ---------------- | ------------------------- | ---------------------------------------------------------------------------------------------- |
| `billing`        | Billing page, admins only | Creates a Checkout session (`checkout`) or a portal session (`portal`) for the caller's masjid |
| `stripe-webhook` | Stripe, signed            | Keeps `masjid_billing` in step with Stripe                                                     |
| `billing-jobs`   | pg_cron, hourly           | Trial and free-Pro reminder emails; expires tax-exemption certificates                         |
| `tax-exemptions` | Platform admins           | Approves or rejects a certificate, then updates the Stripe customer                            |

**The webhook never trusts the event's copy.** Every handled event leads to a subscription, which it fetches fresh from Stripe and maps with `billingFromSubscription()` in `_shared/stripe.ts`. Late, repeated or out-of-order events therefore can't leave a masjid on the wrong plan, and `stripe_events` skips redeliveries. The subscription's `metadata.masjid_id`, set at checkout, says which masjid it belongs to; a subscription without it is ignored.

**Grace runs from the failed invoice**, not from when the webhook saw it, so later retries can't extend it.

**Tax exemption is per customer in Stripe, not per state.** `syncTaxExemption()` in `_shared/tax-exemption.ts` marks the customer exempt only while an approved, unexpired certificate covers the US state of its billing address, and adds a "Tax status" line to invoices. It runs after a decision, at checkout, on `customer.updated` and `checkout.session.completed`, and when `billing-jobs` lapses an expired certificate.

## Plan limits

Every limit is enforced in Postgres, so it holds outside the console; refusals raise SQLSTATE `SH402` with a message meant for the admin. A downgrade deletes nothing: screens over the limit are paused (`display_screens.paused_at`), Pro-only content is left out of the display payload and the app feed, and moderators lose access until the masjid upgrades. The console side is in [Admin console](./admin-console.md#plan-limits).

## Testing

Use the Stripe sandbox and its test card `4242 4242 4242 4242` with any future date and CVC. The Workbench shell in the Stripe dashboard runs `stripe …` commands against the sandbox without a local CLI; it has no pipes, and keystrokes outside its prompt trigger dashboard shortcuts.

- Updating a customer's address in Stripe replaces the whole address, so send every field, never one.
- A subscription created without `metadata.masjid_id` is ignored by the webhook, which makes it safe for trying out tax or proration.
- Stripe can't delete a tax registration; a test one is ended by setting `expires_at` to now.
- After Checkout, Stripe returns the admin to `CONSOLE_URL`, so the post-payment step of the Billing page can only be tried on the deployed site.

Before switching from the sandbox to live keys, clear every `stripe_customer_id` and `stripe_subscription_id` in `masjid_billing`: sandbox ids don't exist in live mode.
