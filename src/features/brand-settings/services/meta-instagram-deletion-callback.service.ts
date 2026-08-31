import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import {
  BrandInstagramDeletionService,
  newMetaConfirmationCode,
} from "./brand-instagram-deletion.service";

@Injectable()
export class MetaInstagramDeletionCallbackService {
  constructor(private readonly deletion: BrandInstagramDeletionService) {}

  async handle(signedRequest: string) {
    const payload = verifySignedRequest(signedRequest);
    const confirmationCode = newMetaConfirmationCode();
    const requestHash = createHash("sha256")
      .update(signedRequest)
      .digest("hex");
    const receipt = await this.deletion.requestByMetaCallback({
      providerAppScopedUserId: payload.userId,
      callbackRequestHash: requestHash,
      confirmationCode,
    });
    const baseUrl = (
      process.env.PUBLIC_API_BASE_URL ?? "http://localhost:3000"
    ).replace(/\/$/, "");
    return {
      url: `${baseUrl}/api/v1/meta/instagram/data-deletion/status/${receipt.confirmationCode}`,
      confirmation_code: receipt.confirmationCode,
    };
  }
}

function verifySignedRequest(signedRequest: string): { userId: string } {
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appSecret)
    throw new BadRequestException("Instagram app is not configured");
  const [signaturePart, payloadPart, extra] = signedRequest.split(".");
  if (!signaturePart || !payloadPart || extra) {
    throw new UnauthorizedException("Invalid signed request");
  }
  const supplied = Buffer.from(signaturePart, "base64url");
  const expected = createHmac("sha256", appSecret).update(payloadPart).digest();
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    throw new UnauthorizedException("Invalid signed request");
  }
  let payload: unknown;
  try {
    payload = JSON.parse(
      Buffer.from(payloadPart, "base64url").toString("utf8"),
    );
  } catch {
    throw new UnauthorizedException("Invalid signed request");
  }
  if (!isRecord(payload) || payload.algorithm !== "HMAC-SHA256") {
    throw new UnauthorizedException("Unsupported signed request algorithm");
  }
  const userId = payload.user_id;
  if (typeof userId !== "string" || !userId.trim()) {
    throw new BadRequestException("Signed request subject is missing");
  }
  return { userId };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
