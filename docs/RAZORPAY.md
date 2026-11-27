# Razorpay checkout

Paid course pages show **Pay with Razorpay** when the API has all three settings below. Checkout uses the saved course price in INR, and a captured payment grants access automatically. Offline payment requests remain available through the existing flow.

## Configure and deploy

1. Rotate any Razorpay API key that has been shared. Start with replacement **test** credentials and a separate test database. Use live credentials only in the live environment.
2. Enable automatic payment capture in the Razorpay Dashboard. Add an HTTPS webhook for `payment.captured` at `https://<api-host>/api/v1/payments/razorpay/webhook` and choose a separate webhook secret. [Razorpay capture and webhook checklist](https://security.razorpay.com/security/checklist/)
3. Set these variables in `apps/api/.env` for local testing or in the API server's secret store for deployment. The browser receives only the public key ID and the order details needed by Razorpay Checkout.

   ```ini
   RAZORPAY_KEY_ID=
   RAZORPAY_KEY_SECRET=
   RAZORPAY_WEBHOOK_SECRET=
   ```

4. Apply the migration on a database with reconciled migration history, regenerate Prisma Client, then restart the API.

   ```powershell
   npm.cmd exec -w @aspireedge/api -- prisma migrate deploy
   npm.cmd run db:generate
   ```

   For an existing local database created with schema sync and no migration history, apply just the additive SQL once.

   ```powershell
   npm.cmd exec -w @aspireedge/api -- prisma db execute --schema prisma/schema.prisma --file prisma/migrations/20261128020000_razorpay_course_orders/migration.sql
   ```

## Test before going live

Sign in as a verified student without an active enrollment, open a published paid course, and complete a Razorpay test payment. Confirm the amount, the paid entry in Purchase History, and access to the course player. Repeat with a dismissed checkout and confirm access is still blocked. Test the webhook with the browser closed so it can confirm the capture independently of the browser callback. An existing pending checkout can be reopened at the amount recorded when its order was created. Refund and dispute handling are managed in the Razorpay Dashboard.
