import { BadRequestException, Injectable } from "@nestjs/common";
import {
  BrandRole,
  InstagramOAuthIntent,
  ProviderOAuthProvider,
  ProviderOAuthSubjectType,
} from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";

import { PrismaService } from "../../prisma/prisma.service";

export const PROVIDER_OAUTH_TRANSACTION_TTL_MS = 10 * 60 * 1000;
export const hashProviderOAuthState = (state: string): string =>
  createHash("sha256").update(state).digest("hex");

type SubjectBinding =
  | {
      subjectType: typeof ProviderOAuthSubjectType.BRAND;
      brandProfileId: string;
      creatorProfileId?: never;
      initiatedByRole: BrandRole;
    }
  | {
      subjectType: typeof ProviderOAuthSubjectType.CREATOR;
      creatorProfileId: string;
      brandProfileId?: never;
      initiatedByRole?: never;
    };

export type ProviderOAuthTransactionContext = SubjectBinding & {
  provider: ProviderOAuthProvider;
  initiatedByUserId: string;
  redirectUri: string;
  intent: InstagramOAuthIntent;
  expectedGeneration?: number;
  expectedProviderAccountId?: string | null;
};

const invalidState = () =>
  new BadRequestException({
    code: "INVALID_INSTAGRAM_OAUTH_STATE",
    message:
      "Instagram authorization expired or is invalid. Start a new connection attempt.",
  });

/** Reusable server-authoritative OAuth state issuance and one-time consumption. */
@Injectable()
export class ProviderOAuthTransactionService {
  constructor(private readonly prisma: PrismaService) {}

  async issue(context: ProviderOAuthTransactionContext): Promise<string> {
    this.assertRedirectUri(context.redirectUri);
    const state = randomBytes(32).toString("base64url");
    await this.prisma.providerOAuthTransaction.create({
      data: {
        provider: context.provider,
        subjectType: context.subjectType,
        brandProfileId:
          context.subjectType === ProviderOAuthSubjectType.BRAND
            ? context.brandProfileId
            : null,
        creatorProfileId:
          context.subjectType === ProviderOAuthSubjectType.CREATOR
            ? context.creatorProfileId
            : null,
        initiatedByUserId: context.initiatedByUserId,
        stateHash: hashProviderOAuthState(state),
        redirectUri: context.redirectUri,
        intent: context.intent,
        initiatedByRole:
          context.subjectType === ProviderOAuthSubjectType.BRAND
            ? context.initiatedByRole
            : null,
        expectedGeneration: context.expectedGeneration ?? 0,
        expectedProviderAccountId: context.expectedProviderAccountId ?? null,
        expiresAt: new Date(Date.now() + PROVIDER_OAUTH_TRANSACTION_TTL_MS),
      },
    });
    return state;
  }

  async consume(context: ProviderOAuthTransactionContext, state: string) {
    if (typeof state !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(state)) {
      throw invalidState();
    }
    const stateHash = hashProviderOAuthState(state);
    const subjectWhere =
      context.subjectType === ProviderOAuthSubjectType.BRAND
        ? { brandProfileId: context.brandProfileId, creatorProfileId: null }
        : { creatorProfileId: context.creatorProfileId, brandProfileId: null };
    const result = await this.prisma.providerOAuthTransaction.updateMany({
      where: {
        provider: context.provider,
        subjectType: context.subjectType,
        initiatedByUserId: context.initiatedByUserId,
        redirectUri: context.redirectUri,
        stateHash,
        consumedAt: null,
        expiresAt: { gt: new Date() },
        ...subjectWhere,
      },
      data: { consumedAt: new Date() },
    });
    if (result.count !== 1) throw invalidState();
    return this.prisma.providerOAuthTransaction.findUniqueOrThrow({
      where: { stateHash },
    });
  }

  private assertRedirectUri(value: string): void {
    let redirect: URL;
    try {
      redirect = new URL(value);
    } catch {
      throw new BadRequestException(
        "A valid Instagram redirect URI is required.",
      );
    }
    if (
      !["https:", "http:"].includes(redirect.protocol) ||
      redirect.username ||
      redirect.password ||
      redirect.hash
    ) {
      throw new BadRequestException(
        "A valid HTTP(S) Instagram redirect URI without credentials or fragment is required.",
      );
    }
  }
}
