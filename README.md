# College Canteen Management System

Production-oriented Next.js/Firebase/Razorpay canteen platform based on `canteen_pdr_v3.docx`.

## Current implementation

- Student menu, account prompt, cart, checkout demo flow, and order tracking.
- Staff live queue simulation with status transitions and offline banner.
- Admin dashboard with operational metrics and menu availability controls.
- Firebase rules, storage rules, composite indexes, function skeletons, ISR revalidation endpoint, and first-admin bootstrap script.

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill Firebase/Razorpay values.

3. Run the app:

   ```bash
   npm run dev
   ```

The frontend currently works in demo mode even before Firebase values are configured.

## First admin bootstrap

After creating the first admin user in Firebase Auth, run:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json node scripts/bootstrap-admin.js <firebase-auth-uid>
```

This script is local-only and must not be deployed as a Cloud Function.

## Production notes

- Replace demo checkout with `initiatePayment` and `verifyPayment` callable functions.
- Configure Razorpay secrets in Secret Manager.
- Deploy `firestore.rules`, `storage.rules`, and `firestore.indexes.json` before staff/admin testing.
- Keep all business-day logic in `Asia/Kolkata`.
# CanteenManagement
