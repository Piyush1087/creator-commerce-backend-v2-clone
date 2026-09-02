import { randomBytes, scrypt, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 64;
function deriveAsync(plain: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(plain, salt, KEY_LENGTH, SCRYPT_PARAMS, (error, derived) => {
      if (error) reject(error);
      else resolve(derived);
    });
  });
}

export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(plain, salt, KEY_LENGTH, SCRYPT_PARAMS);
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return false;
  }
  const [, salt, hashHex] = parts;
  const derived = scryptSync(plain, salt, KEY_LENGTH, SCRYPT_PARAMS);
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length !== derived.length) {
    return false;
  }
  return timingSafeEqual(expected, derived);
}

export function isRecognizedPasswordHash(
  stored: string | null | undefined,
): stored is string {
  return (
    typeof stored === "string" &&
    /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/i.test(stored)
  );
}

export async function hashPasswordAsync(plain: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await deriveAsync(plain, salt);
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPasswordAsync(
  plain: string,
  stored: string,
): Promise<boolean> {
  if (!isRecognizedPasswordHash(stored)) return false;
  const [, salt, hashHex] = stored.split("$");
  const derived = await deriveAsync(plain, salt);
  const expected = Buffer.from(hashHex, "hex");
  return (
    expected.length === derived.length && timingSafeEqual(expected, derived)
  );
}
