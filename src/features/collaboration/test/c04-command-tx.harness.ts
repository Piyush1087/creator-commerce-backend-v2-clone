/**
 * Shared Prisma surfaces C-04 command tests omitted after outbox / audit /
 * advisory-lock / payouts lineage landings. Does not invent domain outcomes.
 */
export function patchC04CommandTx(
  tx: Record<string, unknown>,
  row: Record<string, unknown> = {},
): void {
  const collaboration = (tx.collaboration ?? {}) as Record<string, unknown>;
  const existingFindUnique = collaboration.findUnique as
    | ((args: unknown) => Promise<unknown>)
    | undefined;
  collaboration.findUnique =
    existingFindUnique ??
    (async () => ({
      creatorWorkspaceId: row.creatorWorkspaceId ?? "workspace-1",
      creatorProfileId: row.creatorProfileId ?? "profile-1",
      creatorWorkspace: {
        organizationId: row.organizationId ?? "org-1",
      },
    }));
  tx.collaboration = collaboration;

  const events = tx.collaborationEvent as
    | { create?: (args: unknown) => Promise<unknown> | unknown }
    | undefined;
    if (events?.create) {
    const original = events.create.bind(events);
    events.create = async (args: unknown) => {
      const created = await original(args);
      if (created && typeof created === "object" && "id" in created) {
        return created;
      }
      const payload =
        args && typeof args === "object" && "data" in args
          ? (args as { data?: Record<string, unknown> }).data
          : undefined;
      const data =
        created && typeof created === "object"
          ? created
          : (payload ?? {});
      return { id: "event-1", ...(data as Record<string, unknown>) };
    };
  }

  if (!tx.collaborationProjectionOutbox) {
    tx.collaborationProjectionOutbox = {
      createMany: async () => ({ count: 3 }),
    };
  }
  if (!tx.creatorWorkspaceMember) {
    tx.creatorWorkspaceMember = {
      findFirst: async () => ({ id: "membership-1", securityRole: "OWNER" }),
    };
  }
  if (!tx.$executeRaw) {
    tx.$executeRaw = async () => undefined;
  }
  if (!tx.collaborationReserveInstruction) {
    tx.collaborationReserveInstruction = {
      findFirst: async () => null,
      create: async ({ data }: { data: unknown }) => data,
    };
  }
  if (!tx.collaborationCommercialAgreement) {
    const agreement = (row.commercialAgreement ?? {}) as Record<string, unknown>;
    tx.collaborationCommercialAgreement = {
      findUniqueOrThrow: async () => ({
        id: agreement.id ?? "agreement-1",
        ...agreement,
      }),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(agreement, data);
        return agreement;
      },
    };
  }
  if (!tx.collaborationTrustedConfirmation) {
    tx.collaborationTrustedConfirmation = {
      findMany: async () => [
        { id: "confirm-1", reserveInstructionId: "reserve-1" },
      ],
    };
  }
  if (!tx.collaborationFinancialAuthorityInstruction) {
    tx.collaborationFinancialAuthorityInstruction = {
      findFirst: async () => null,
      create: async ({ data }: { data: unknown }) => data,
    };
  }
}
