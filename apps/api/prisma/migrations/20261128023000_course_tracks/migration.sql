BEGIN;

CREATE TYPE "CourseTrack" AS ENUM ('SKILL_BOOST', 'PROFESSIONAL_MASTERY', 'CAREER_LAUNCH');
ALTER TABLE "Course" ADD COLUMN "track" "CourseTrack" NOT NULL DEFAULT 'SKILL_BOOST';
UPDATE "Course" SET "track" = CASE
  WHEN trim(lower("category")) IN ('professional mastery', 'professional mastery courses') THEN 'PROFESSIONAL_MASTERY'::"CourseTrack"
  WHEN trim(lower("category")) IN ('career launch', 'career launch courses') THEN 'CAREER_LAUNCH'::"CourseTrack"
  ELSE "track"
END
WHERE "tenantId" IS NULL;
CREATE INDEX "Course_tenantId_status_track_idx" ON "Course"("tenantId", "status", "track");

COMMIT;
