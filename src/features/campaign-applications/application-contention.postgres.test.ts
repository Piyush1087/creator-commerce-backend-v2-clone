import "reflect-metadata";
import { PrismaClient, type Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  applicationHarness,
  creatorFixture,
  brandFixture,
  campaignFixture,
  teamFixture,
} from "../../../test/fixtures/c03-application-fixtures";

describe.skipIf(process.env.C03_P13_DATABASE_TEST !== "true")(
  "C03 P1.3 PostgreSQL contention and permanent guards",
  () => {
    const prisma = new PrismaClient({
      transactionOptions: { timeout: 30000, maxWait: 10000 },
    });
    const h = applicationHarness(prisma);
    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? "");
      if (
        url.hostname !== "localhost" ||
        url.pathname !==
          (process.env.C03_P14_DATABASE_TEST === "true"
            ? "/c03_p14_handoff"
            : "/c03_p13")
      )
        throw new Error("C03_P13_DISPOSABLE_DATABASE_REQUIRED");
      await prisma.$connect();
    });
    afterAll(() => prisma.$disconnect());
    async function fixture() {
      const owner = await creatorFixture(prisma),
        brand = await brandFixture(prisma);
      const c = await campaignFixture(prisma, brand.brand.id);
      return { owner, brand, c };
    }
    /** Both callers must demonstrably wait in PostgreSQL before releasing the
     * workspace barrier. This tests actual overlapping commands, not mock locks. */
    async function race<T>(
      workspaceId: string,
      commands: Array<() => Promise<T>>,
    ) {
      let unlock!: () => void, ready!: () => void;
      const released = new Promise<void>((resolve) => {
        unlock = resolve;
      });
      const acquired = new Promise<void>((resolve) => {
        ready = resolve;
      });
      const barrier = prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM creator_workspaces WHERE id = ${workspaceId} FOR UPDATE`;
        ready();
        await released;
      });
      await acquired;
      const pending = Promise.allSettled(commands.map((command) => command()));
      try {
        let waiting = 0;
        const deadline = Date.now() + 8000;
        while (Date.now() < deadline) {
          const rows = await prisma.$queryRaw<
            Array<{ count: bigint }>
          >`SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%creator_workspaces%'`;
          waiting = Number(rows[0].count);
          if (waiting >= commands.length) break;
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        expect(waiting).toBeGreaterThanOrEqual(commands.length);
      } finally {
        unlock();
        await barrier;
      }
      return pending;
    }
    const fulfilled = <T>(results: PromiseSettledResult<T>[]) =>
      results.filter(
        (r): r is PromiseFulfilledResult<T> => r.status === "fulfilled",
      );

    it("concurrent identical keys commit one Application, snapshot, event and receipt and return identical results", async () => {
      const f = await fixture(),
        key = randomUUID();
      const command = () =>
        h.submit.submit(f.owner.user, f.c.campaign.id, f.c.selection(), key);
      const results = await race(f.owner.workspace.id, [command, command]);
      const successes = fulfilled(results);
      expect(successes).toHaveLength(2);
      expect(successes[0].value).toEqual(successes[1].value);
      const id = successes[0].value.applicationId;
      expect(
        await prisma.uceApplication.count({
          where: { campaignId: f.c.campaign.id },
        }),
      ).toBe(1);
      expect(
        await prisma.uceApplicationSnapshot.count({
          where: { applicationId: id },
        }),
      ).toBe(1);
      expect(
        await prisma.applicationDomainEvent.count({
          where: { applicationId: id },
        }),
      ).toBe(1);
      expect(
        await prisma.applicationCommandReceipt.count({
          where: { applicationId: id },
        }),
      ).toBe(1);
    });

    it.each(["different fingerprint", "different keys", "Owner and Assistant"])(
      "concurrent %s cannot create duplicate authority",
      async (kind) => {
        const f = await fixture(),
          key = randomUUID();
        const assistant = await teamFixture(prisma, f.owner, "ASSISTANT");
        const results = await race(f.owner.workspace.id, [
          () =>
            h.submit.submit(
              f.owner.user,
              f.c.campaign.id,
              f.c.selection(),
              key,
            ),
          () =>
            h.submit.submit(
              kind === "Owner and Assistant" ? assistant.user : f.owner.user,
              f.c.campaign.id,
              f.c.selection(kind === "different fingerprint" ? 1 : 0),
              kind === "different fingerprint" ? key : randomUUID(),
            ),
        ]);
        expect(fulfilled(results)).toHaveLength(1);
        const rejected = results.find(
          (r) => r.status === "rejected",
        ) as PromiseRejectedResult;
        expect(rejected.reason.response.code).toBe(
          kind === "different fingerprint"
            ? "APPLICATION_IDEMPOTENCY_KEY_REUSED"
            : "APPLICATION_OPPORTUNITY_ALREADY_USED",
        );
        const rows = await prisma.uceApplication.findMany({
          where: { campaignId: f.c.campaign.id },
          include: { snapshot: true, domainEvents: true },
        });
        expect(rows).toHaveLength(1);
        expect(rows[0].subjectCreatorProfileId).toBe(f.owner.profile.id);
        expect(rows[0].snapshot?.actorContext).toMatchObject({
          actorUserId: rows[0].actorUserId,
          actorRole: rows[0].actorRole,
        });
        expect(rows[0].domainEvents[0].actorUserId).toBe(rows[0].actorUserId);
      },
    );

    it("Campaign quota: one existing plus two contenders results in exactly two", async () => {
      const f = await fixture();
      await h.submit.submit(
        f.owner.user,
        f.c.campaign.id,
        f.c.selection(),
        randomUUID(),
      );
      const results = await race(
        f.owner.workspace.id,
        [1, 2].map(
          (i) => () =>
            h.submit.submit(
              f.owner.user,
              f.c.campaign.id,
              f.c.selection(i),
              randomUUID(),
            ),
        ),
      );
      expect(fulfilled(results)).toHaveLength(1);
      expect(
        await prisma.uceApplication.count({
          where: {
            subjectCreatorProfileId: f.owner.profile.id,
            campaignId: f.c.campaign.id,
            status: { not: "WITHDRAWN" },
          },
        }),
      ).toBe(2);
    });

    it("Brand quota: four existing across Campaigns plus two contenders results in exactly five", async () => {
      const f = await fixture();
      const campaigns = [f.c];
      for (let i = 1; i < 3; i++)
        campaigns.push(await campaignFixture(prisma, f.brand.brand.id));
      for (const c of campaigns.slice(0, 2))
        for (const i of [0, 1])
          await h.submit.submit(
            f.owner.user,
            c.campaign.id,
            c.selection(i),
            randomUUID(),
          );
      const last = campaigns[2];
      const results = await race(
        f.owner.workspace.id,
        [0, 1].map(
          (i) => () =>
            h.submit.submit(
              f.owner.user,
              last.campaign.id,
              last.selection(i),
              randomUUID(),
            ),
        ),
      );
      expect(fulfilled(results)).toHaveLength(1);
      expect(
        await prisma.uceApplication.count({
          where: {
            subjectCreatorProfileId: f.owner.profile.id,
            brandProfileId: f.brand.brand.id,
            status: { not: "WITHDRAWN" },
          },
        }),
      ).toBe(5);
    });

    it.each([
      ["WITHDRAW", "REJECT"],
      ["REJECT", "EXPIRE"],
      ["WITHDRAW", "EXPIRE"],
    ] as const)(
      "terminal race %s / %s has one durable winner",
      async (left, right) => {
        const f = await fixture();
        const first = await h.submit.submit(
          f.owner.user,
          f.c.campaign.id,
          f.c.selection(),
          randomUUID(),
        );
        const command = (kind: string) => async (): Promise<unknown> => {
          if (kind === "WITHDRAW")
            return h.terminal.withdraw(
              f.owner.user,
              first.applicationId,
              randomUUID(),
            );
          if (kind === "REJECT")
            return h.terminal.decide(
              f.brand.user,
              f.c.campaign.id,
              first.applicationId,
              "REJECT",
              randomUUID(),
            );
          return h.terminal.expirePending([first.applicationId]);
        };
        const results = await race(f.owner.workspace.id, [
          command(left),
          command(right),
        ]);
        const row = await prisma.uceApplication.findUniqueOrThrow({
          where: { id: first.applicationId },
          include: { domainEvents: true },
        });
        expect(row.status).not.toBe("PENDING");
        expect(row.statusVersion).toBe(2);
        expect(row.terminalAt).not.toBeNull();
        expect(row.domainEvents).toHaveLength(2);
        expect(
          row.domainEvents.filter((e) => e.applicationVersion === 2),
        ).toHaveLength(1);
        for (const result of results)
          if (result.status === "rejected")
            expect(result.reason.response.code).toBe(
              "APPLICATION_TRANSITION_CONFLICT",
            );
      },
    );

    it("permanent PostgreSQL guards reject snapshot/event/identity/status/deletion/duplicate/receipt violations independently of commands", async () => {
      const f = await fixture(),
        result = await h.submit.submit(
          f.owner.user,
          f.c.campaign.id,
          f.c.selection(),
          randomUUID(),
        );
      const row = await prisma.uceApplication.findUniqueOrThrow({
        where: { id: result.applicationId },
        include: { snapshot: true, domainEvents: true, commandReceipts: true },
      });
      await expect(
        prisma.uceApplicationSnapshot.update({
          where: { applicationId: row.id },
          data: { campaignContext: { name: "rewritten" } },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.uceApplicationSnapshot.delete({
          where: { applicationId: row.id },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.uceApplication.delete({ where: { id: row.id } }),
      ).rejects.toThrow();
      await expect(
        prisma.uceApplication.update({
          where: { id: row.id },
          data: { canonicalBriefId: f.c.briefs[1].id },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.uceApplication.update({
          where: { id: row.id },
          data: { actorUserId: f.brand.user.id },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.uceApplication.update({
          where: { id: row.id },
          data: { status: "REJECTED" },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.applicationDomainEvent.update({
          where: { id: row.domainEvents[0].id },
          data: { eventVersion: 9 },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.applicationDomainEvent.delete({
          where: { id: row.domainEvents[0].id },
        }),
      ).rejects.toThrow();
      const {
        snapshot: _snapshot,
        domainEvents: _events,
        commandReceipts: _receipts,
        ...applicationData
      } = row;
      await expect(
        prisma.uceApplication.create({
          data: { ...applicationData, id: randomUUID() },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.applicationDomainEvent.create({
          data: {
            ...row.domainEvents[0],
            id: randomUUID(),
            transitionId: randomUUID(),
          },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.applicationCommandReceipt.create({
          data: { ...row.commandReceipts[0], id: randomUUID() },
        }),
      ).rejects.toThrow();
      const { id: _id, ...snapshotData } = row.snapshot!;
      await expect(
        prisma.uceApplicationSnapshot.create({ data: { ...snapshotData } }),
      ).rejects.toThrow();
      expect(
        (
          await prisma.uceApplication.findUniqueOrThrow({
            where: { id: row.id },
          })
        ).status,
      ).toBe("PENDING");
    });

    it("deferred evidence and scoped receipt uniqueness hold independently of service enforcement", async () => {
      const f = await fixture();
      const result = await h.submit.submit(
        f.owner.user,
        f.c.campaign.id,
        f.c.selection(),
        randomUUID(),
      );
      const original = await prisma.uceApplication.findUniqueOrThrow({
        where: { id: result.applicationId },
        include: { snapshot: true, domainEvents: true, commandReceipts: true },
      });
      const { snapshot, domainEvents, commandReceipts, ...application } =
        original;
      async function attempt(
        mode: "missing-snapshot" | "missing-event" | "duplicate-receipt",
      ) {
        return prisma.$transaction(async (tx) => {
          const id = randomUUID(),
            transitionId = randomUUID();
          await tx.uceApplication.create({
            data: { ...application, id, canonicalBriefId: f.c.briefs[1].id },
          });
          if (mode !== "missing-snapshot") {
            // Copy an already-proven fixture snapshot, then bind its selection.
            const copy = JSON.parse(
              JSON.stringify(snapshot),
            ) as Prisma.UceApplicationSnapshotUncheckedCreateInput;
            await tx.uceApplicationSnapshot.create({
              data: {
                ...copy,
                id: randomUUID(),
                applicationId: id,
                briefContext: {
                  id: f.c.briefs[1].id,
                  campaignAssetId: f.c.asset.id,
                  briefName: "Historical Brief 1",
                },
              },
            });
          }
          if (mode !== "missing-event")
            await tx.applicationDomainEvent.create({
              data: {
                ...domainEvents[0],
                id: randomUUID(),
                transitionId,
                applicationId: id,
                canonicalBriefId: f.c.briefs[1].id,
              },
            });
          if (mode === "duplicate-receipt") {
            const receipt = commandReceipts[0];
            await tx.$executeRaw`INSERT INTO application_command_receipts
              (id, command_type, actor_user_id, authority_subject_id, idempotency_key_digest, request_fingerprint, application_id, transition_id)
              VALUES (${randomUUID()}, 'SUBMIT', ${receipt.actorUserId}, ${receipt.authoritySubjectId},
                ${receipt.idempotencyKeyDigest}, ${receipt.requestFingerprint}, ${id}, ${transitionId})`;
          }
        });
      }
      await expect(attempt("missing-snapshot")).rejects.toThrow(
        /C03_CANONICAL_APPLICATION_REQUIRES_ONE_SNAPSHOT/,
      );
      await expect(attempt("missing-event")).rejects.toThrow(
        /C03_CANONICAL_APPLICATION_REQUIRES_MATCHING_EVENT/,
      );
      await expect(attempt("duplicate-receipt")).rejects.toThrow(
        /23505[\s\S]*Key \(command_type, actor_user_id, authority_subject_id, idempotency_key_digest\)/,
      );
      expect(
        await prisma.uceApplication.count({
          where: { campaignId: f.c.campaign.id },
        }),
      ).toBe(1);
      await h.terminal.expirePending([original.id]);
      await expect(
        prisma.uceApplication.update({
          where: { id: original.id },
          data: { status: "WITHDRAWN" },
        }),
      ).rejects.toThrow(/C03_APPLICATION_TRANSITION_INVALID/);
    });
  },
);
