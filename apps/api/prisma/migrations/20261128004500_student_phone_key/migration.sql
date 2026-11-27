BEGIN;

ALTER TABLE "StudentAccount" ADD COLUMN "phoneKey" TEXT;

UPDATE "StudentAccount"
SET "phoneKey" = NULLIF(
  regexp_replace(
    regexp_replace(regexp_replace("phone", '[^0-9]', '', 'g'), '^00(?=[0-9])', ''),
    '^(91|0)(?=[6-9][0-9]{9}$)', ''
  ),
  ''
)
WHERE "phone" IS NOT NULL;

CREATE INDEX "StudentAccount_phoneKey_idx" ON "StudentAccount"("phoneKey");

COMMIT;
