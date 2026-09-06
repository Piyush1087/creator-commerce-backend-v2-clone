-- BP-G05: preserve every canonical Campaign NET term as a distinct relational value.
-- Additive only: existing enum labels and stored rows are preserved.
ALTER TYPE "UcePayoutTerms" ADD VALUE IF NOT EXISTS 'NET_45';
ALTER TYPE "UcePayoutTerms" ADD VALUE IF NOT EXISTS 'NET_60';
