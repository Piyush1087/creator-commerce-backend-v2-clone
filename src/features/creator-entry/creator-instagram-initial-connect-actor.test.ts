import { ForbiddenException } from "@nestjs/common";
import {
  InstagramOAuthIntent,
  InstagramProfessionalAccountType,
  ProviderOAuthProvider,
  ProviderOAuthSubjectType,
  UserRole,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../prisma/prisma.service";
import { decryptField } from "../../shared/crypto/field-encryption.util";
import type { CreatorWorkspaceActorContext } from "../../shared/creator/creator-workspace-actor.contract";
import type { AuthUser } from "../auth/types/auth-user";
import type { CreatorWorkspaceActorService } from "../creator-settings/team/creator-workspace-actor.service";
import type { InstagramGraphClient } from "../instagram/instagram-graph.client";
import type { InstagramOAuthClient } from "../instagram/instagram-oauth.client";
import type { CreatorInstagramOAuthTransactionService } from "../provider-oauth/creator-instagram-oauth-transaction.service";
import type { CreatorEntryStateService } from "./creator-entry-state.service";
import { CreatorInstagramConnectionService } from "./creator-instagram-connection.service";

const REDIRECT_URI =
  "https://dashboard.dev.thecreatorshop.in/creator-marketplace/callback";
const BASIC = "instagram_business_basic";
const INSIGHTS = "instagram_business_manage_insights";

const manager: AuthUser = {
  id: "manager-user",
  email: "manager@example.test",
  name: "Manager",
  role: UserRole.CREATOR,
  organizationId: "manager-organization",
};

const managerContext: CreatorWorkspaceActorContext = {
  actorUserId: manager.id,
  actorMembershipId: "manager-membership",
  actorRole: "MANAGER",
  workspaceId: "owner-workspace",
  organizationId: "owner-organization",
  subjectCreatorProfileId: "owner-profile",
  subjectOwnerUserId: "owner-user",
  allowedActions: ["INSTAGRAM_SETTINGS_READ", "INSTAGRAM_SETTINGS_MANAGE"],
};

describe("C-05 actor/subject adapter for C-01 initial Instagram connect", () => {
  let issue: ReturnType<typeof vi.fn>;
  let consume: ReturnType<typeof vi.fn>;
  let create: ReturnType<typeof vi.fn>;
  let findUnique: ReturnType<typeof vi.fn>;
  let resolve: ReturnType<typeof vi.fn>;
  let resolveInTransaction: ReturnType<typeof vi.fn>;
  let readCanonicalOwner: ReturnType<typeof vi.fn>;
  let service: CreatorInstagramConnectionService;

  beforeEach(() => {
    vi.stubEnv("CREATOR_INSTAGRAM_REDIRECT_URI", REDIRECT_URI);
    vi.stubEnv("SETTINGS_FIELD_ENCRYPTION_KEY", "c05-p2-field-key");
    vi.stubEnv("INSTAGRAM_API_ID", "test-instagram-app-id");

    create = vi.fn().mockResolvedValue({ id: "integration" });
    findUnique = vi.fn().mockResolvedValue(null);
    const social = { findUnique, create };
    const transaction = { creatorSocialIntegration: social };
    const prisma = {
      creatorSocialIntegration: social,
      $transaction: vi.fn(
        async (operation: (tx: typeof transaction) => Promise<unknown>) =>
          operation(transaction),
      ),
    } as unknown as PrismaService;

    issue = vi.fn().mockResolvedValue("s".repeat(43));
    consume = vi.fn().mockResolvedValue({
      provider: ProviderOAuthProvider.INSTAGRAM,
      subjectType: ProviderOAuthSubjectType.CREATOR,
      creatorProfileId: managerContext.subjectCreatorProfileId,
      initiatedByUserId: manager.id,
      redirectUri: REDIRECT_URI,
      intent: InstagramOAuthIntent.INITIAL_CONNECT,
      expectedGeneration: 0,
      expectedProviderAccountId: null,
    });
    const transactions = {
      issue,
      consume,
    } as unknown as CreatorInstagramOAuthTransactionService;

    const oauth = {
      buildAuthorizeUrl: vi.fn(
        (_redirectUri: string, state: string) =>
          `https://www.instagram.com/oauth/authorize?state=${state}`,
      ),
      exchangeAuthorizationCode: vi.fn().mockResolvedValue({
        accessToken: "manager-created-secret-token",
        expiresInSeconds: 3_600,
        permissions: [BASIC, INSIGHTS],
      }),
    } as unknown as InstagramOAuthClient;
    const graph = {
      fetchMe: vi.fn().mockResolvedValue({
        userId: "permanent-provider-user",
        appScopedUserId: "app-scoped-user",
        username: "creator_handle",
        name: "Creator Name",
        accountType: InstagramProfessionalAccountType.CREATOR,
        profilePictureUrl: "https://images.example.test/avatar.jpg",
        followersCount: 10,
        followsCount: 5,
        mediaCount: 20,
      }),
      fetchGrantedPermissions: vi.fn().mockResolvedValue([BASIC, INSIGHTS]),
    } as unknown as InstagramGraphClient;

    readCanonicalOwner = vi.fn().mockResolvedValue({
      accountContext: "CREATOR_READY",
      onboardingStatus: "COMPLETE",
      canEnterCreatorPlatform: true,
      nextAction: "CREATOR_WORKSPACE_ENTRY",
      instagram: {},
    });
    const state = {
      readCanonicalOwner,
    } as unknown as CreatorEntryStateService;
    resolve = vi.fn().mockResolvedValue(managerContext);
    resolveInTransaction = vi.fn().mockResolvedValue(managerContext);
    const actors = {
      resolve,
      resolveInTransaction,
    } as unknown as CreatorWorkspaceActorService;

    service = new CreatorInstagramConnectionService(
      prisma,
      transactions,
      oauth,
      graph,
      state,
      actors,
    );
  });

  it("issues generation-zero OAuth for the real Manager actor and Owner subject", async () => {
    await expect(service.authorize(manager)).resolves.toEqual({
      authorizationUrl: expect.stringContaining("state="),
    });
    expect(issue).toHaveBeenCalledWith({
      creatorProfileId: managerContext.subjectCreatorProfileId,
      initiatedByUserId: manager.id,
      redirectUri: REDIRECT_URI,
      intent: InstagramOAuthIntent.INITIAL_CONNECT,
      expectedGeneration: 0,
      expectedProviderAccountId: null,
    });
  });

  it("re-resolves the actor under transaction and encrypts the permanent identity binding", async () => {
    const result = await service.complete(manager, {
      state: "s".repeat(43),
      code: "provider-code",
    });

    expect(consume).toHaveBeenCalledWith(
      {
        creatorProfileId: managerContext.subjectCreatorProfileId,
        initiatedByUserId: manager.id,
        redirectUri: REDIRECT_URI,
        intent: InstagramOAuthIntent.INITIAL_CONNECT,
        expectedGeneration: 0,
        expectedProviderAccountId: null,
      },
      "s".repeat(43),
    );
    expect(resolveInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      manager,
      managerContext.workspaceId,
    );
    const persisted = create.mock.calls[0][0].data as Record<string, unknown>;
    expect(persisted).toMatchObject({
      creatorProfileId: managerContext.subjectCreatorProfileId,
      nativePlatformUserId: "permanent-provider-user",
      authorizationGeneration: 1,
      credentialVersion: 1,
    });
    expect(persisted.oauthAccessTokenEncrypted).not.toBe(
      "manager-created-secret-token",
    );
    expect(decryptField(persisted.oauthAccessTokenEncrypted as string)).toBe(
      "manager-created-secret-token",
    );
    expect(readCanonicalOwner).toHaveBeenCalledWith(
      managerContext.subjectOwnerUserId,
    );
    expect(findUnique).toHaveBeenCalledWith({
      where: {
        platformNetwork_nativePlatformUserId: {
          platformNetwork: "INSTAGRAM",
          nativePlatformUserId: "permanent-provider-user",
        },
      },
      select: { creatorProfileId: true },
    });
    expect(result).toMatchObject({ connected: true });
  });

  it("fails closed when the permanent provider identity belongs to another subject", async () => {
    findUnique.mockImplementation(async (query: Record<string, unknown>) =>
      "platformNetwork_nativePlatformUserId" in
      ((query.where as Record<string, unknown> | undefined) ?? {})
        ? { creatorProfileId: "other-creator-profile" }
        : null,
    );

    await expect(
      service.complete(manager, {
        state: "s".repeat(43),
        code: "provider-code",
      }),
    ).rejects.toMatchObject({
      response: { code: "INSTAGRAM_IDENTITY_ALREADY_IN_USE" },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("denies an Assistant before issuing an OAuth transaction", async () => {
    resolve.mockResolvedValue({
      ...managerContext,
      actorRole: "ASSISTANT",
      allowedActions: [],
    });
    await expect(service.authorize(manager)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(issue).not.toHaveBeenCalled();
  });
});
