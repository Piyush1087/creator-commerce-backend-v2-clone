CREATE TYPE "CollaborationFeedbackAuthorRole" AS ENUM ('BRAND', 'CREATOR');
CREATE TYPE "CollaborationFeedbackVisibility" AS ENUM ('HIDDEN', 'REVEALED');

CREATE TABLE "collaboration_feedback_windows" (
    "id" TEXT NOT NULL,
    "collaboration_id" TEXT NOT NULL,
    "opened_at" TIMESTAMP(3) NOT NULL,
    "closes_at" TIMESTAMP(3) NOT NULL,
    "visibility" "CollaborationFeedbackVisibility" NOT NULL DEFAULT 'HIDDEN',
    "revealed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "collaboration_feedback_windows_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "collaboration_feedback" (
    "id" TEXT NOT NULL,
    "collaboration_id" TEXT NOT NULL,
    "author_role" "CollaborationFeedbackAuthorRole" NOT NULL,
    "author_user_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "review_text" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "collaboration_feedback_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "collaboration_feedback_rating_check" CHECK ("rating" BETWEEN 1 AND 5)
);

CREATE UNIQUE INDEX "collaboration_feedback_windows_collaboration_id_key" ON "collaboration_feedback_windows"("collaboration_id");
CREATE INDEX "collaboration_feedback_windows_visibility_closes_at_idx" ON "collaboration_feedback_windows"("visibility", "closes_at");
CREATE UNIQUE INDEX "collaboration_feedback_collaboration_id_author_role_key" ON "collaboration_feedback"("collaboration_id", "author_role");
CREATE INDEX "collaboration_feedback_collaboration_id_submitted_at_idx" ON "collaboration_feedback"("collaboration_id", "submitted_at");

ALTER TABLE "collaboration_feedback_windows" ADD CONSTRAINT "collaboration_feedback_windows_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collaboration_feedback" ADD CONSTRAINT "collaboration_feedback_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
