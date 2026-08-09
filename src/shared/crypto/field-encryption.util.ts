import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function resolveKey(): Buffer {
  const raw = process.env.SETTINGS_FIELD_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error(
      "SETTINGS_FIELD_ENCRYPTION_KEY is required for encrypted settings fields",
    );
  }
  return createHash("sha256").update(raw).digest();
}

export function encryptField(plaintext: string): string {
  const key = resolveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptField(payload: string): string {
  const key = resolveKey();
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted field payload");
  }
  const iv = Buffer.from(ivB64, "base64url");
  const authTag = Buffer.from(tagB64, "base64url");
  const encrypted = Buffer.from(dataB64, "base64url");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function maskSensitiveString(
  value: string | null | undefined,
  visiblePrefix = 2,
  visibleSuffix = 2,
): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length <= visiblePrefix + visibleSuffix) {
    return "*".repeat(trimmed.length);
  }
  const hiddenLength = trimmed.length - visiblePrefix - visibleSuffix;
  return (
    trimmed.slice(0, visiblePrefix) +
    "X".repeat(hiddenLength) +
    trimmed.slice(-visibleSuffix)
  );
}

export function maskAccountLast4(accountNumber: string): string {
  const digits = accountNumber.replace(/\D/g, "");
  if (digits.length < 4) {
    return "****";
  }
  return `****${digits.slice(-4)}`;
}
