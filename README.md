# Aminzi Phone Shop

React + Vite + Tailwind + Supabase. The UI follows the supplied reference's soft raised cards, blue/cyan accents, rounded panels and mobile controls. English, Dari and Pashto are supported, with document-wide RTL switching.

## Run locally

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Add your project URL and **publishable key** to `.env`:

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR-PUBLISHABLE-KEY
```

Restart Vite after changing environment variables. Never use a service-role key in `.env` or frontend code. Without credentials, Login offers an explicitly labeled demo workspace. Demo business records are in memory, reset on reload, and never sent to Supabase. Language and theme preferences alone use localStorage.

## Run all database migrations in Supabase

Use a fresh Supabase project. Open **SQL Editor**, paste **`supabase/all-migrations.sql`**, and run it once. This is the complete combined schema, permissions, RLS/privilege restrictions, transactions, read API and administration RPC.

Alternatively, run these files **in order**, once each:

1. `supabase/migrations/202610060001_schema.sql`
2. `supabase/migrations/202610060002_operations.sql`
3. `supabase/migrations/202610060003_read_api.sql`
4. `supabase/migrations/202610060004_admin.sql`

Choose the combined file OR the individual migrations; do not run both. The SQL intentionally does not drop or overwrite an existing database. All combined migrations run in one transaction, so failures roll back the installation.

## Set up the first administrator

1. In Supabase **Authentication → Sign In / Providers**, disable **Allow new users to sign up**. This dashboard setting is essential: SQL alone cannot turn off Auth signup.
2. In **Authentication → Users → Add user**, create `admin@aminzi.af` with your own strong password and mark the email confirmed. Do not use the staff default password for this bootstrap administrator.
3. Run `supabase/bootstrap-admin.sql` in SQL Editor. If using another email, update both the lookup and inserted profile email/username consistently.
4. Sign in with `admin` or `admin@aminzi.af`.

## Deploy secure user management

User creation requires a Supabase Edge Function. SQL migrations alone cannot create Auth users securely.

With the Supabase CLI installed and logged in:

```powershell
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy manage-user
```

The source is `supabase/functions/manage-user/index.ts`; configuration is `supabase/config.toml`. Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to deployed functions. The function validates the caller token with `auth.getUser`, checks the active profile, first-login gate and granular permissions before administrative actions. Disabling gateway JWT verification does not disable the function's own authentication.

Staff usernames generate `username@aminzi.af`, initially with `user123` as requested. New profiles require a password change before any business RPC is permitted. The password-change trigger clears this gate when Supabase Auth updates the password hash. Disabled users may still receive an Auth session, but every shop read/write is denied by the database. Re-enable through Users.

## Database protection

- RLS is enabled on every business table. There are intentionally no permissive raw-table policies. Raw table privileges are revoked from anon/authenticated; React exclusively calls checked SECURITY DEFINER RPCs.
- Read RPCs return costs, selling prices, profit and analytics only when the corresponding permissions are present. Sensitive columns are never downloaded and merely hidden afterward.
- Purchase creates product, purchase, inventory and IMEI registry rows atomically. A global IMEI primary key catches duplicates across both slots, including sold stock.
- Sale locks inventory with `FOR UPDATE`, validates stock, records cost/product/shop snapshots, and decrements quantity in one transaction. Concurrent overselling and double sales are prevented by the row lock.
- Monetary values use fixed precision `numeric`; historical profit is generated from the saved sale cost and price.
- Each accessory purchase is a distinct costed stock lot. Choose the lot when selling; quantity uses that lot's actual cost. There is no implicit weighted-cost or FIFO assumption.
- Stock with sale history cannot be edited/deleted. This preserves receipts and accounting history. Pre-sale stock edits keep original IMEI and quantity immutable; purchase-cost changes require cost permission.
- No customers, suppliers, credit, returns or payment integrations are included. Sales are cash in AFN.
- Dashboard day/month boundaries use `Asia/Kabul`. Receipt dates display in the browser's local timezone.
- Receipt RPCs exclude unit cost and profit. PDF generation captures the rendered receipt to preserve Dari/Pashto glyphs. Logo URLs should be HTTPS and permit CORS for PDF inclusion.
- Downloading receipts also requires selling-price permission, because customer receipts necessarily contain the selling price. The permission form selects this dependency automatically.
- No service-role credentials are embedded in frontend code. The first-admin script is an owner-only setup action.

## Verification

```powershell
npm test
npm run build
```

Tests execute every migration in embedded PostgreSQL (PGlite) with a minimal mock `auth` schema. They cover purchase atomicity, dual-slot IMEI uniqueness, phone/accessory sales, sold-stock rejection, oversell rollback, financial calculations, historical receipts, raw-table denial, financial redaction, disabled profiles and the first-login gate. This verifies PostgreSQL business logic, not the hosted Supabase Auth service or deployed Edge Function.

For launch, run these hosted checks after setup: login/logout and refresh, unauthorized URLs, first-login password update, create/edit/disable staff, granular permissions under two real accounts, simultaneous stock sale in two sessions, and PDF printing/downloading in your intended mobile/desktop browser.

## Structure

`src/components` contains shared UI, layout, forms and receipts; `src/pages` contains authentication, dashboard, records and settings; `src/context` handles sessions/data/language; `src/services` separates real RPCs from demo data; `src/i18n` keeps all three language dictionaries; `supabase` contains the runnable SQL and Edge Function; `tests` exercises business rules and migrations.

The read API currently loads permitted records in one call and the UI filters/paginates them. For very large shops, extend the RPCs with server-side pagination and indexed search before importing a large history.
