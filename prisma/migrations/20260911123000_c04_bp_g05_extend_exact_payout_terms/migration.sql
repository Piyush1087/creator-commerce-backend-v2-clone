-- C-04 convergence of accepted Campaign BP-G05 exact payout terms.
-- Additive only; existing enum labels and stored rows are preserved.
ALTER TYPE "UcePayoutTerms" ADD VALUE IF NOT EXISTS 'NET_45';
ALTER TYPE "UcePayoutTerms" ADD VALUE IF NOT EXISTS 'NET_60';
