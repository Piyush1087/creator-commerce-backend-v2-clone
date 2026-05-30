-- CreateIndex
CREATE INDEX "brand_audience_personas_brand_profile_id_idx" ON "brand_audience_personas"("brand_profile_id");

-- RenameIndex
ALTER INDEX "brand_performance_leaks_brand_profile_id_is_archived_priority_r" RENAME TO "brand_performance_leaks_brand_profile_id_is_archived_priori_idx";
