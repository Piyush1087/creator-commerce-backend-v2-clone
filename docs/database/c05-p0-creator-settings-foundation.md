# C-05 P0 Creator Settings foundation

This checkpoint adds only the schema and shared contract foundation required by
the bounded C-05 implementation streams. It does not add feature behavior,
authorize legacy Team rows, or migrate production data.

## Additive migrations

1. 20260909120000_c05_p0_team_user_identity
   - Adds nullable CreatorWorkspaceMember.userId.
   - Keeps assignedProfileId and associatedEmail for compatibility.
   - Adds a partial unique index for one active membership per
     workspace/User.
   - Does not derive a User from email or backfill any row.
2. 20260909121000_c05_p0_contact_phone
   - Preserves the legacy phone value.
   - Adds calling-code, national-number, and canonical E.164 fields.
   - Does not infer structured values from historical text.
3. 20260909122000_c05_p0_legal_profile
   - Adds one minimum legal profile per Creator.
   - Supports Individual and Business payees.
   - Deliberately excludes PAN, tax identifiers, documents, KYC, and
     verification evidence.
4. 20260909123000_c05_p0_payout_destination
   - Adds provider-neutral Bank Account, UPI, and PayPal destinations.
   - Stores method-specific secrets only in an encrypted payload.
   - Stores an ordinary server-generated masked display.
   - Defaults new destinations to CONFIGURED_UNVERIFIED.
   - Adds a partial unique index for one active primary destination per
     Creator.
   - Keeps provider references in a separate mapping keyed to destination
     version.

## Later checkpoint responsibilities

- P1B may populate direct membership User identity only from unambiguous
  canonical evidence. Unresolved rows remain unauthorized.
- P1A owns validation and normalization when a user saves contact details.
- P1D owns encryption, masking, supported country/rail policy, and
  compatibility adapters.
- No legacy VERIFIED state is canonical verification evidence.
- Legacy payout rows and PAN require separately reviewed retention or
  reconciliation; the P0 migrations do not read, copy, alter, or delete them.

Initial migration replay must use a disposable PostgreSQL database. Production
or other persistent-data inspection is outside this checkpoint.
