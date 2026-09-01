import { UserRole } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import type { MailService } from "../../../mail/mail.service";
import type { PrismaService } from "../../../prisma/prisma.service";
import type { CreatorWorkspaceActorContext } from "../../../shared/creator/creator-workspace-actor.contract";
import type { AuthUser } from "../../auth/types/auth-user";
import { CreatorTeamInvitationsService } from "./creator-team-invitations.service";
import type { CreatorWorkspaceActorService } from "./creator-workspace-actor.service";

const owner: AuthUser = {
  id: "owner-user",
  email: "owner@example.test",
  name: "Owner",
  role: UserRole.CREATOR,
  organizationId: "organization",
};

const actor: CreatorWorkspaceActorContext = {
  actorUserId: owner.id,
  actorMembershipId: "owner-membership",
  actorRole: "OWNER",
  workspaceId: "workspace",
  organizationId: "organization",
  subjectCreatorProfileId: "owner-profile",
  subjectOwnerUserId: owner.id,
  allowedActions: ["TEAM_READ", "TEAM_MANAGE"],
};

type PendingInvitation = {
  id: string;
  recipientEmail: string;
  allocatedRole: "MANAGER" | "ASSISTANT";
  expiresAt: Date;
  invitationStatus: "PENDING";
};

/**
 * A deterministic transaction scheduler: every callback receives the same
 * workspace-lock lane and releases it only when the callback settles. This is
 * not a replacement for the five real-PostgreSQL cases; it proves service
 * decisions under an adversarial same-workspace interleaving without relying
 * on a wire-protocol multiplexer.
 */
function concurrencyHarness(activeMembers: number) {
  const pending: PendingInvitation[] = [];
  const events: string[] = [];
  let transactionTail = Promise.resolve();
  let transactionNumber = 0;

  const prisma = {
    $transaction: vi.fn(
      <T>(operation: (transaction: unknown) => Promise<T>): Promise<T> => {
        const transactionId = ++transactionNumber;
        const run = transactionTail.then(async () => {
          const record = (event: string) =>
            events.push(`tx${transactionId}:${event}`);
          const transaction = {
            $queryRaw: vi.fn(async () => {
              record("workspace-lock");
              return [{ id: actor.workspaceId }];
            }),
            creatorWorkspaceMember: {
              findFirst: vi.fn(async () => {
                record("member-duplicate-read");
                return null;
              }),
              count: vi.fn(async () => {
                record("capacity-member-count");
                return activeMembers;
              }),
            },
            creatorWorkspaceInvitation: {
              updateMany: vi.fn(async () => {
                record("expire-pending");
                return { count: 0 };
              }),
              findFirst: vi.fn(
                async (query: {
                  where?: { recipientEmail?: { equals?: unknown } };
                }) => {
                  record("invitation-duplicate-read");
                  const email = query.where?.recipientEmail?.equals;
                  if (typeof email !== "string") return null;
                  return (
                    pending.find(
                      (row) =>
                        row.recipientEmail.toLowerCase() ===
                        email.toLowerCase(),
                    ) ?? null
                  );
                },
              ),
              count: vi.fn(async () => {
                record("capacity-invitation-count");
                return pending.length;
              }),
              create: vi.fn(
                async (query: {
                  data: Omit<PendingInvitation, "id" | "invitationStatus">;
                }) => {
                  record("invitation-create");
                  const invitation: PendingInvitation = {
                    id: `invitation-${pending.length + 1}`,
                    ...query.data,
                    invitationStatus: "PENDING",
                  };
                  pending.push(invitation);
                  return invitation;
                },
              ),
            },
            creatorWorkspace: {
              findUniqueOrThrow: vi.fn(async () => {
                record("workspace-read");
                return { organization: { name: "Creator Studio" } };
              }),
            },
          };
          return operation(transaction);
        });
        transactionTail = run.then(
          () => undefined,
          () => undefined,
        );
        return run;
      },
    ),
  } as unknown as PrismaService;

  const actors = {
    resolve: vi.fn().mockResolvedValue(actor),
    resolveInTransaction: vi.fn().mockResolvedValue(actor),
  } as unknown as CreatorWorkspaceActorService;
  const mail = {
    sendCreatorTeamInvitation: vi.fn().mockResolvedValue(undefined),
  } as unknown as MailService;

  return {
    service: new CreatorTeamInvitationsService(prisma, actors, mail),
    pending,
    events,
  };
}

describe("C-05 deterministic Team transaction scheduler", () => {
  it("serializes a same-email duplicate race to one pending invitation", async () => {
    const harness = concurrencyHarness(1);
    const results = await Promise.allSettled([
      harness.service.create(owner, {
        recipientEmail: "member@example.test",
        allocatedRole: "MANAGER",
      }),
      harness.service.create(owner, {
        recipientEmail: "MEMBER@example.test",
        allocatedRole: "MANAGER",
      }),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(harness.pending).toHaveLength(1);
    expect(harness.pending[0].recipientEmail).toBe("member@example.test");
  });

  it("serializes a final-seat race to exactly one admission reservation", async () => {
    const harness = concurrencyHarness(4);
    const results = await Promise.allSettled([
      harness.service.create(owner, {
        recipientEmail: "first@example.test",
        allocatedRole: "ASSISTANT",
      }),
      harness.service.create(owner, {
        recipientEmail: "second@example.test",
        allocatedRole: "ASSISTANT",
      }),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(harness.pending).toHaveLength(1);
  });

  it("keeps the workspace FOR UPDATE ahead of duplicate and capacity reads", () => {
    const invitations = readFileSync(
      join(
        process.cwd(),
        "src/features/creator-settings/team/creator-team-invitations.service.ts",
      ),
      "utf8",
    );
    const create = invitations.slice(
      invitations.indexOf("async create("),
      invitations.indexOf("async inspect("),
    );
    expect(
      create.indexOf("lockCreatorTeam(tx, initial.workspaceId)"),
    ).toBeGreaterThan(-1);
    expect(
      create.indexOf("lockCreatorTeam(tx, initial.workspaceId)"),
    ).toBeLessThan(create.indexOf("conflictingMember"));
    expect(
      create.indexOf("lockCreatorTeam(tx, initial.workspaceId)"),
    ).toBeLessThan(create.indexOf("pendingDuplicate"));
    expect(
      create.indexOf("lockCreatorTeam(tx, initial.workspaceId)"),
    ).toBeLessThan(create.indexOf("activeMembers"));

    const policy = readFileSync(
      join(
        process.cwd(),
        "src/features/creator-settings/team/creator-team.policy.ts",
      ),
      "utf8",
    );
    expect(policy).toMatch(/creator_workspaces[\s\S]*FOR UPDATE/);
  });

  it("retains five real-PostgreSQL cases as environment-gated acceptance", () => {
    const postgres = readFileSync(
      join(
        process.cwd(),
        "src/features/creator-settings/team/creator-team.postgres.test.ts",
      ),
      "utf8",
    );
    expect(postgres).toContain("C05_TEAM_DATABASE_TEST");
    expect(postgres.match(/\n\s+it\(/g)).toHaveLength(5);
    expect(postgres).toContain("environment-gated acceptance");
  });
});
