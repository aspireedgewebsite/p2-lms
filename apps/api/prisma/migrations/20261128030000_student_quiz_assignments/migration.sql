ALTER TABLE "Quiz" ADD COLUMN "assignmentOnly" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "QuizAssignment" (
    "quizId" TEXT NOT NULL REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY ("quizId", "userId")
);
CREATE INDEX "QuizAssignment_userId_idx" ON "QuizAssignment"("userId");
