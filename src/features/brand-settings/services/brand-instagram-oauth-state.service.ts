import { BadRequestException, Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../../../prisma/prisma.service";

export const INSTAGRAM_SETTINGS_STATE_TTL_MS = 10 * 60 * 1000;
export const hashInstagramSettingsState = (state: string): string =>
  createHash("sha256").update(state).digest("hex");

type AttemptContext = {
  brandProfileId: string;
  initiatedByUserId: string;
  redirectUri: string;
};

/** Only the authenticated Brand Settings Instagram handshake uses this store. */
@Injectable()
export class BrandInstagramOAuthStateService {
  constructor(private readonly prisma: PrismaService) {}

  async issue(context: AttemptContext): Promise<string> {
    let redirect: URL;
    try {
      redirect = new URL(context.redirectUri);
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
    const state = randomBytes(32).toString("base64url");
    await this.prisma.brandInstagramOAuthState.create({
      data: {
        ...context,
        stateHash: hashInstagramSettingsState(state),
        expiresAt: new Date(Date.now() + INSTAGRAM_SETTINGS_STATE_TTL_MS),
      },
    });
    return state;
  }

  async consume(context: AttemptContext, state: string): Promise<void> {
    const invalid = () =>
      new BadRequestException({
        code: "INVALID_INSTAGRAM_OAUTH_STATE",
        message:
          "Instagram authorization expired or is invalid. Start a new connection attempt.",
      });
    if (typeof state !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(state)) {
      throw invalid();
    }
    const now = new Date();
    // One conditional UPDATE is the reservation and validation boundary. PostgreSQL
    // rechecks the predicate after a competing updater commits; only one wins.
    // Commit before provider I/O, and never undo consumption on exchange failure.
    const result = await this.prisma.brandInstagramOAuthState.updateMany({
      where: {
        ...context,
        stateHash: hashInstagramSettingsState(state),
        consumedAt: null,
        expiresAt: { gt: now },
      },
      data: { consumedAt: now },
    });
    if (result.count !== 1) throw invalid();
  }
}
