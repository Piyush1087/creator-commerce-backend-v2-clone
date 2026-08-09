-- CreateIndex (guarded for out-of-order local shadow DB)
DO $$
BEGIN
  IF to_regclass('public.brand_audience_personas') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "brand_audience_personas_brand_profile_id_idx" ON "brand_audience_personas"("brand_profile_id")';
  END IF;
END $$;

-- RenameIndex (guarded; may not exist in fresh shadow DB)
DO $$
BEGIN
  IF to_regclass('public.brand_performance_leaks_brand_profile_id_is_archived_priority_r') IS NOT NULL THEN
    EXECUTE 'ALTER INDEX "brand_performance_leaks_brand_profile_id_is_archived_priority_r" RENAME TO "brand_performance_leaks_brand_profile_id_is_archived_priori_idx"';
  END IF;
END $$;
