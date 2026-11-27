# Registration email verification

## Configure Resend

1. Rotate any Resend key that has been shared. Add `aspireedgegroup.com` under **Domains** in Resend, publish the DNS records Resend supplies, and wait for the domain to show as **Verified**. Create a replacement key with sending access. [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction)
2. Set the following variables in `apps/api/.env` locally or in the API server's secret store. The frontend needs none of them.

   ```ini
   RESEND_API_KEY=
   EMAIL_FROM="Aspireedge <noreply@aspireedgegroup.com>"
   EMAIL_OTP_SECRET=
   ```

3. Generate a separate OTP secret with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Keep it consistent across API instances. Rotating this secret invalidates outstanding codes. Restart the API after configuration.

Resend is used for registration codes. A successful send response means Resend accepted the message for delivery. Check the recipient inbox or Resend's email events for delivery status. The existing password-reset worker and administrator verification-link flow use their existing delivery mechanism. [Resend Send Email API](https://resend.com/docs/api-reference/emails/send-email)

## Apply the database change

For a database with reconciled migration history, run the following from the repository root:

```powershell
npm.cmd exec -w @aspireedge/api -- prisma migrate deploy
npm.cmd run db:generate
```

The project has a documented missing initial migration. For an existing local database created with schema sync that already contains the prior tables and columns but has no migration history, apply only this additive migration once:

```powershell
npm.cmd exec -w @aspireedge/api -- prisma db execute --schema prisma/schema.prisma --file prisma/migrations/20261128011500_registration_otp/migration.sql
npm.cmd run db:generate
```

If Windows reports a locked Prisma engine DLL, stop your API process, regenerate the client, and restart it. Existing unverified student accounts can sign in with their current credentials to reach the verification screen and request a code. The seeded platform administrator continues to use the existing administrator sign-in flow.

## Verify the workflow

1. Run `npm.cmd run dev` and register with an email inbox you control, an unused mobile number, and the existing gender/password fields.
2. Check that the verification page opens and that the email arrives from **Aspireedge**. Try signing in before verification and confirm that access is denied.
3. Enter an incorrect code, then enter the correct code. Confirm the success message, sign in again, and open the student dashboard.
4. Test resend after 60 seconds and confirm the previous code fails. Wait five minutes to test expiry, and submit five wrong codes to confirm the old challenge is locked even if the sixth submission is correct.
5. Confirm signup rejects an existing email and an existing mobile number. Check the verification page at mobile and desktop widths.

Registration, verification, and resend use `/api/v1/auth/register`, `/api/v1/auth/verify-email`, and `/api/v1/auth/resend-otp`. Verification and resend have IP rate limits, and the resend cooldown and verification attempt counter are enforced in PostgreSQL. For multi-instance production deployments, use a shared store for the Express IP rate limiters.

## Recover an existing unverified student account

Open **Sign in**, enter the account's email address, and choose **Resend Verification OTP**. Enter the newest code on the verification page, then use the existing password to sign in. A new registration is unnecessary.

If Resend is unavailable and you own the local test account, add the following to `apps/api/.env` and restart the API:

```ini
DEV_OTP_RECOVERY_EMAIL=your-test-address@example.com
```

The local mailbox works only in development with a loopback PostgreSQL connection and a localhost web origin. It applies only to the exact address configured above, including for new registrations of that address. Resending writes the latest code to `apps/api/.local-mail/student-verification.txt`. Open that file locally, enter the code on the website, and sign in as usual. Attempts, expiry, and cooldown still apply. Keep the mailbox private, remove the local message when finished, and clear `DEV_OTP_RECOVERY_EMAIL` before restarting the API to resume normal delivery for that address.
