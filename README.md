# Hanakasu Mantri

## Firebase setup

Each account uses Firebase Authentication and a private Cloud Firestore
document at `users/{uid}/appData/current`. Firestore rules only allow a
verified user to read or write their own document. The profile email is
read-only and always follows the verified Firebase sign-in email.

1. Create a Firebase project and register a web app.
2. In Authentication, click **Get started**, enable **Email/Password** and
   **Google**, and authorize `localhost`, `127.0.0.1`, and your production
   domain. `CONFIGURATION_NOT_FOUND` means Firebase Authentication has not been
   initialized for the project.
3. Create a Cloud Firestore database.
4. Copy `.env.example` to `.env` and set the four `VITE_FIREBASE_*` values from
   the Firebase web app settings. Set `FIREBASE_PROJECT_ID` to the same project
   ID for server-side token verification.
5. In Authentication, configure the **Email address verification** and
   **Password reset** templates. Signup verification and password recovery use
   Firebase's built-in email links.
6. To send app-specific email alerts and security codes, set `EMAIL_WEBHOOK_URL`
   to the existing HTTPS email webhook. Firebase Authentication does not send
   arbitrary app emails.
7. Publish `firestore.rules` using the Firebase CLI (`firebase deploy
   --only firestore:rules`) or paste its rules into the Firebase console.

Cloud data is scoped to the Firebase user ID, not just the email text. Sign in
on each device to the same Firebase account and provider. If you see **Sync
failed**, use the on-screen error and retry after deploying the rules; a
Firestore `permission-denied` error usually means the current rules were not
published or the signed-in email is not verified.

For manual rule setup, open Firebase Console for the app's project, go to
**Firestore Database → Rules**, replace the editor contents with
`firestore.rules`, and click **Publish**. In **Authentication → Users**, confirm
the account's email is verified, then sign out and back in to refresh its
verified token. For a local Vite `Failed to fetch dynamically imported module`
error, restart the dev server with `npm run dev -- --force` to rebuild its
dependency cache.

Until Firebase is configured, the app shows a setup screen and does not load
financial data. Do not loosen the database rules to make local development
work.

## Financial data defaults

New users start with Cash Wallet and the standard transaction categories;
banks, cards, investments, automatic payments, and goals are added by the
user. On existing signed-in data, the built-in sample records are removed
automatically while transactions and user-created records are retained.
Credit-card limits, alert percentages, due dates, and payment bank are set per
card. The emergency reserve is excluded from spendable balances and counted
once in net worth; withdrawals are made from Wealth to a selected bank.

## Local development

1. Copy `.env.example` to `.env`.
2. Set `EMAIL_WEBHOOK_URL` to the existing HTTPS email webhook; it is required
   for app-specific email alerts and security codes.
3. Generate a Gemini API key in [Google AI Studio](https://aistudio.google.com/app/apikey)
   and set `GEMINI_API_KEY=your-key` in `.env` to enable transaction suggestions
   and optional financial insights. Restart Vite after changing the key. Keep it
   server-side; do not use a `VITE_` prefix or commit the secret.
4. Set the Firebase values above, then run `npm install` and `npm run dev`.

The Firebase web configuration is public client configuration; access control
is enforced by verified Firebase ID tokens and Firestore rules. The
Gemini key and email webhook URL are server-side only. Transaction text plus
category/account labels are sent to Gemini for interpretation; account
balances are not included. The optional financial-insights action sends only
monthly income, expense, and category totals after the user requests analysis;
it does not send transaction descriptions, account names, or IDs.

## Deployment

Set these values in the hosting provider's environment configuration:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `FIREBASE_PROJECT_ID`
- `GEMINI_API_KEY` (optional)
- `EMAIL_WEBHOOK_URL` (required for app-specific email alerts and security codes)

Vercel uses the functions under `api/`. Netlify uses the functions under
`netlify/functions/` and the rewrites in `netlify.toml`. Other static hosts
need equivalent serverless endpoints for `/api/webhook` and
`/api/parse-transaction` and `/api/financial-advice`.

The webhook now accepts authenticated email delivery only; legacy global
database pull/push actions are disabled. The former Apps Script background
schedule feed is not migrated because it is not user-isolated.

## Existing data

On a device with the previous app's local data, the first signed-in account is
offered an explicit import choice. Import only if that data belongs to that
account. The import is assigned to that UID and is not copied to later
accounts. Other devices or data that exists only in the old shared cloud
database must be exported from the old app and restored into the intended
account; the new app will not read the shared legacy database.

Build with `npm run build`; the production assets are written to `dist`.
