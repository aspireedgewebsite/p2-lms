BEGIN;

ALTER TABLE "Lesson" ADD COLUMN "courseId" TEXT, ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT TRUE;
WITH ordered AS (
  SELECT l."id", m."courseId", m."archivedAt",
         row_number() OVER (PARTITION BY m."courseId" ORDER BY m."position", m."createdAt", m."id", l."position", l."createdAt", l."id") - 1 AS position
  FROM "Lesson" l JOIN "CourseModule" m ON m."id" = l."moduleId"
)
UPDATE "Lesson" l
SET "courseId" = o."courseId", "position" = o.position, "archivedAt" = COALESCE(l."archivedAt", o."archivedAt")
FROM ordered o WHERE l."id" = o."id";

ALTER TABLE "Lesson" ALTER COLUMN "courseId" SET NOT NULL,
  ALTER COLUMN "published" SET DEFAULT FALSE,
  ALTER COLUMN "moduleId" DROP NOT NULL,
  DROP CONSTRAINT "Lesson_moduleId_fkey",
  ADD CONSTRAINT "Lesson_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
DROP INDEX "Lesson_moduleId_position_idx";
CREATE INDEX "Lesson_courseId_position_idx" ON "Lesson"("courseId", "position");

CREATE TYPE "LessonResourceKind" AS ENUM ('PDF', 'PPT');
CREATE TABLE "LessonResource" (
  "id" TEXT PRIMARY KEY,
  "lessonId" TEXT NOT NULL REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "title" TEXT NOT NULL,
  "kind" "LessonResourceKind" NOT NULL,
  "url" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "LessonResource_lessonId_createdAt_idx" ON "LessonResource"("lessonId", "createdAt");
INSERT INTO "LessonResource" ("id", "lessonId", "title", "kind", "url")
SELECT md5("id" || ':pdf')::uuid::text, "id", 'PDF', 'PDF'::"LessonResourceKind", "pdfUrl" FROM "Lesson" WHERE "pdfUrl" IS NOT NULL AND "pdfUrl" <> ''
UNION ALL
SELECT md5("id" || ':ppt')::uuid::text, "id", 'PowerPoint', 'PPT'::"LessonResourceKind", "presentationUrl" FROM "Lesson" WHERE "presentationUrl" IS NOT NULL AND "presentationUrl" <> '';
ALTER TABLE "Lesson" DROP COLUMN "pdfUrl", DROP COLUMN "presentationUrl";

COMMIT;
