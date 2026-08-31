import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";

const suite =
  process.env.RUN_BS09_P3C2_POSTGRES_TESTS === "true"
    ? describe
    : describe.skip;

suite("BS-09 P3C2 PostgreSQL payout invariants", () => {
  const db = new PrismaClient();

  afterAll(() => db.$disconnect());

  it("installs amount checks and immutable provider correlations", async () => {
    const url = new URL(process.env.DATABASE_URL ?? "");
    if (
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      !url.pathname.startsWith("/bs09_")
    )
      throw new Error("BS-09 requires a disposable loopback bs09_* database");

    const constraints = await db.$queryRaw<Array<{ name: string }>>`
      SELECT conname AS name
      FROM pg_constraint
      WHERE conname IN (
        'creator_payout_obligations_positive_amount',
        'route_transfer_attempts_positive_amount',
        'route_transfer_reversals_positive_amount',
        'creator_payout_obligations_collaboration_id_fkey',
        'creator_payout_obligations_brand_id_fkey',
        'creator_payout_obligations_creator_profile_id_fkey'
      )
    `;
    expect(new Set(constraints.map((row) => row.name))).toEqual(
      new Set([
        "creator_payout_obligations_positive_amount",
        "route_transfer_attempts_positive_amount",
        "route_transfer_reversals_positive_amount",
        "creator_payout_obligations_collaboration_id_fkey",
        "creator_payout_obligations_brand_id_fkey",
        "creator_payout_obligations_creator_profile_id_fkey",
      ]),
    );

    const indexes = await db.$queryRaw<Array<{ name: string }>>`
      SELECT indexname AS name
      FROM pg_indexes
      WHERE indexname IN (
        'creator_payout_obligations_settlement_instruction_id_key',
        'route_transfer_attempts_idempotency_key_key',
        'route_transfer_attempts_transfer_id_key',
        'route_transfer_reversals_idempotency_key_key',
        'route_transfer_reversals_reversal_id_key',
        'route_webhook_receipts_event_identity_key'
      )
    `;
    expect(indexes).toHaveLength(6);
  });

  it("keeps processed distinct from settled and models partial reversal", async () => {
    const values = await db.$queryRaw<Array<{ type: string; value: string }>>`
      SELECT t.typname AS type, e.enumlabel AS value
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typname IN ('RouteTransferState', 'RouteSettlementState')
    `;
    const set = new Set(values.map((row) => `${row.type}:${row.value}`));
    expect(set).toContain("RouteTransferState:PROCESSED");
    expect(set).toContain("RouteTransferState:PARTIALLY_REVERSED");
    expect(set).toContain("RouteSettlementState:HELD");
    expect(set).toContain("RouteSettlementState:RELEASE_ELIGIBLE");
    expect(set).toContain("RouteSettlementState:RELEASE_PROCESSING");
    expect(set).toContain("RouteSettlementState:SETTLED");
  });
});
