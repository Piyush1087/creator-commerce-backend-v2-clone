-- CreateEnum
CREATE TYPE "CoPilotFeedbackRating" AS ENUM ('THUMBS_UP', 'THUMBS_DOWN');

-- CreateTable
CREATE TABLE "co_pilot_message_feedback" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "brand_profile_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rating" "CoPilotFeedbackRating" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "co_pilot_message_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "co_pilot_message_feedback_message_id_key" ON "co_pilot_message_feedback"("message_id");

-- CreateIndex
CREATE INDEX "co_pilot_message_feedback_brand_profile_id_created_at_idx" ON "co_pilot_message_feedback"("brand_profile_id", "created_at");

-- AddForeignKey
ALTER TABLE "co_pilot_message_feedback" ADD CONSTRAINT "co_pilot_message_feedback_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "co_pilot_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "co_pilot_message_feedback" ADD CONSTRAINT "co_pilot_message_feedback_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "co_pilot_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "co_pilot_message_feedback" ADD CONSTRAINT "co_pilot_message_feedback_brand_profile_id_fkey" FOREIGN KEY ("brand_profile_id") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "co_pilot_message_feedback" ADD CONSTRAINT "co_pilot_message_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
