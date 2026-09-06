-- Reconcile only rows whose accepted canonical Campaign definition is exact.
-- Unknown or unproven historical rows are intentionally left unchanged.
UPDATE "uce_campaign_commercials" AS commercials
SET "final_balance_terms" = 'NET_45'::"UcePayoutTerms"
FROM "uce_campaigns" AS campaign
WHERE campaign."id" = commercials."campaign_id"
  AND commercials."final_balance_terms" = 'NET_30'::"UcePayoutTerms"
  AND campaign."canonical_definition" #>> '{commercials,payout_terms}' = 'NET_45';

UPDATE "uce_campaign_commercials" AS commercials
SET "final_balance_terms" = 'NET_60'::"UcePayoutTerms"
FROM "uce_campaigns" AS campaign
WHERE campaign."id" = commercials."campaign_id"
  AND commercials."final_balance_terms" = 'NET_30'::"UcePayoutTerms"
  AND campaign."canonical_definition" #>> '{commercials,payout_terms}' = 'NET_60';
