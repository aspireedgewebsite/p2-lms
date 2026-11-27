CREATE TYPE "StudentGender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

ALTER TABLE "StudentAccount" ADD COLUMN "gender" "StudentGender";
