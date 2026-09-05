import { createHmac, timingSafeEqual } from "node:crypto";

import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { resolveJwtSecret } from "../../auth/auth-jwt.config";
import type { BrandPayoutsAuthorizationScopeV1 } from "../contracts/brand-payouts-authorization.contract";

const CURSOR_VERSION = 1 as const;
const CURSOR_MAX_LENGTH = 4096;
const CURSOR_KEY_DOMAIN = "creator-shop:brand-payouts:v2:cursor";

type CursorPayload = {
  readonly version: typeof CURSOR_VERSION;
  readonly endpoint: string;
  readonly filterKey: string;
  readonly brandProfileId: string;
  readonly membershipId: string;
  readonly authorizationVersion: string;
  readonly role: string;
  readonly scope: string;
  readonly asOf: string;
  readonly lastRecordedAt: string;
  readonly lastStableId: string;
};

export type BrandPayoutsCursorBoundary = {
  readonly asOf: Date;
  readonly lastRecordedAt: Date | null;
  readonly lastStableId: string | null;
};

function invalidCursor(): BadRequestException {
  return new BadRequestException({
    code: "BRAND_PAYOUTS_CURSOR_INVALID",
    message: "The Brand Payouts continuation cursor is invalid",
  });
}

function parseInstant(value: string): Date {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    throw invalidCursor();
  }
  return parsed;
}

function isPayload(value: unknown): value is CursorPayload {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    row.version === CURSOR_VERSION &&
    typeof row.endpoint === "string" &&
    typeof row.filterKey === "string" &&
    typeof row.brandProfileId === "string" &&
    typeof row.membershipId === "string" &&
    typeof row.authorizationVersion === "string" &&
    typeof row.role === "string" &&
    typeof row.scope === "string" &&
    typeof row.asOf === "string" &&
    typeof row.lastRecordedAt === "string" &&
    typeof row.lastStableId === "string"
  );
}

@Injectable()
export class BrandPayoutsCursorCodec {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    this.key = createHmac("sha256", resolveJwtSecret(config))
      .update(CURSOR_KEY_DOMAIN)
      .digest();
  }

  decode(input: {
    readonly cursor?: string;
    readonly endpoint: string;
    readonly filterKey: string;
    readonly authorization: BrandPayoutsAuthorizationScopeV1;
    readonly requestAsOf: Date;
  }): BrandPayoutsCursorBoundary {
    if (!input.cursor) {
      return {
        asOf: input.requestAsOf,
        lastRecordedAt: null,
        lastStableId: null,
      };
    }
    if (input.cursor.length > CURSOR_MAX_LENGTH) throw invalidCursor();

    const [encoded, signature, ...rest] = input.cursor.split(".");
    if (!encoded || !signature || rest.length > 0) throw invalidCursor();
    const expected = this.sign(encoded);
    let supplied: Buffer;
    try {
      supplied = Buffer.from(signature, "base64url");
    } catch {
      throw invalidCursor();
    }
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    ) {
      throw invalidCursor();
    }

    let decoded: unknown;
    try {
      decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    } catch {
      throw invalidCursor();
    }
    if (!isPayload(decoded)) throw invalidCursor();

    const scope = input.authorization;
    if (
      decoded.endpoint !== input.endpoint ||
      decoded.filterKey !== input.filterKey ||
      decoded.brandProfileId !== scope.brandProfileId ||
      decoded.membershipId !== scope.membershipId ||
      decoded.authorizationVersion !== scope.authorizationVersion ||
      decoded.role !== scope.role ||
      decoded.scope !== scope.kind
    ) {
      throw invalidCursor();
    }

    const asOf = parseInstant(decoded.asOf);
    const lastRecordedAt = parseInstant(decoded.lastRecordedAt);
    if (
      asOf.getTime() > input.requestAsOf.getTime() ||
      lastRecordedAt.getTime() > asOf.getTime()
    ) {
      throw invalidCursor();
    }
    return { asOf, lastRecordedAt, lastStableId: decoded.lastStableId };
  }

  encode(input: {
    readonly endpoint: string;
    readonly filterKey: string;
    readonly authorization: BrandPayoutsAuthorizationScopeV1;
    readonly asOf: Date;
    readonly lastRecordedAt: Date;
    readonly lastStableId: string;
  }): string {
    const scope = input.authorization;
    const payload: CursorPayload = {
      version: CURSOR_VERSION,
      endpoint: input.endpoint,
      filterKey: input.filterKey,
      brandProfileId: scope.brandProfileId,
      membershipId: scope.membershipId,
      authorizationVersion: scope.authorizationVersion,
      role: scope.role,
      scope: scope.kind,
      asOf: input.asOf.toISOString(),
      lastRecordedAt: input.lastRecordedAt.toISOString(),
      lastStableId: input.lastStableId,
    };
    const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
      "base64url",
    );
    return `${encoded}.${this.sign(encoded).toString("base64url")}`;
  }

  private sign(encoded: string): Buffer {
    return createHmac("sha256", this.key).update(encoded).digest();
  }
}

export function stableFilterKey(
  entries: Readonly<Record<string, readonly string[] | string | undefined>>,
): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(entries)
        .filter(([, value]) => value !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => [
          key,
          Array.isArray(value) ? [...value].sort() : value,
        ]),
    ),
  );
}

/** True when a row belongs after the supplied boundary in descending order. */
export function isAfterCursor(
  recordedAt: Date,
  stableId: string,
  boundary: BrandPayoutsCursorBoundary,
): boolean {
  if (!boundary.lastRecordedAt || !boundary.lastStableId) return true;
  if (recordedAt.getTime() < boundary.lastRecordedAt.getTime()) return true;
  if (recordedAt.getTime() > boundary.lastRecordedAt.getTime()) return false;
  return stableId.localeCompare(boundary.lastStableId) < 0;
}
