# Smart Hospital Management Software

A multi-tenant SaaS platform for hospitals and clinics: OPD registration & live doctor queues, doctor workspace with voice
e-prescriptions, pharmacy POS & inventory, billing/accounts, and a central operator console for plans and licenses.

Copyright © twinsCloud. All rights reserved.

## Structure

| Folder    | What it is |
|-----------|------------|
| `client/` | React 19 + Vite + Tailwind frontend (landing page, registration, all dashboards) |
| `server/` | Express + MongoDB (Mongoose) REST API |

## SaaS model

- **Public website** at `/` describes the product and shows live pricing from the Plans collection.
- **Self-service sign-up** at `/register`: a hospital starts a free trial (length set by the Super Admin, default 14 days)
  or activates directly with a paid license key (`/register?mode=license`). The admin is signed in immediately.
- **Subscriptions**: when a hospital's expiry date passes, staff logins are paused; the hospital admin can still sign in,
  see data and renew with a license key from *Hospital Billing*. Data is never deleted on expiry.
- **Tenant isolation**: every hospital/pharmacy API call requires a signed-in user, and the server always uses the
  hospital from the user's token — a hospital can never read or change another hospital's records.
- **Roles**: Super Admin (platform operator), Hospital Admin, Receptionist, Doctor, Pharmacist. Settings, staff, fees,
  departments and schedules can only be changed by the Hospital Admin.

## What each role does

| Role | Main screens |
|------|--------------|
| **Super Admin** (platform operator) | Platform overview (paying vs trial hospitals, MRR, revenue, follow-ups), hospitals, license keys, plans, financials, settings |
| **Hospital Admin** | Setup checklist, OPD register, staff, OPD setup (fees, doctor rooms/hours/days), departments, reports, accounts (ledger, dues, patient-wise), plan & billing, profile |
| **Receptionist** | Front desk check-in (family-aware phone lookup, fee & payment mode, token slip), live queue, appointments (slots by doctor hours), patient directory, fee collection |
| **Doctor** | Waiting room, call next / hold, vitals & history, complaints/diagnosis/advice/follow-up, prescription builder (pharmacy stock, voice dictation incl. Hinglish), printable Rx, patient records |
| **Pharmacist** | Live prescription queue, dispensing with stock/expiry checks, counter sales, discounts, inventory & batches, stock alerts with reorder CSV, sales history |

## Environment (`server/.env`)

```
PORT=5000
MONGODB_URI=mongodb+srv://...
JWT_SECRET=<long random string — required in production>
ADMIN_EMAIL=<super admin login, used by the seeder and for alert e-mails>
ADMIN_PASSWORD=<super admin password, used by the seeder>
CLIENT_URL=https://your-domain/login        # link used in e-mails
SMTP_HOST= SMTP_PORT= SMTP_SECURE= SMTP_USER= SMTP_PASS= FROM_EMAIL=
# optional
CORS_ORIGIN=https://your-domain              # comma-separated; default allows all
RATE_LIMIT_PER_SEC=25
TZ=Asia/Kolkata                              # default; controls daily OPD token reset and invoice dates
```

## Run locally

```bash
cd server && npm install && npm run dev      # API on :5000
cd client && npm install && npm run dev      # UI on :5173 (proxies /api to :5000)
```

## Tests

```bash
cd server
npm test          # 24 end-to-end API tests on a throwaway in-memory MongoDB (never touches real data)
npm run sandbox   # serves client/dist + API on :5055 with an empty in-memory DB for manual testing
                  # super admin: root@sandbox.test / RootPass#123
```

## Database seeding

`npm run seed` **deletes every collection** and creates default plans, licenses and the Super Admin.
It now refuses to run unless you pass `--force` (`npm run seed -- --force`). Only use it on an empty database.

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which pulls on the VPS, installs dependencies, builds the
client and restarts the `hospital-backend` PM2 process. The Express server also serves `client/dist` (with SPA
fallback) if it exists, so a single process can host both the site and the API.
