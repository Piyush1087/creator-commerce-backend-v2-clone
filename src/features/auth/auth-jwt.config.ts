import { ConfigService } from "@nestjs/config";

export const JWT_EXPIRES_IN = "15m" as const;
export const AUTH_REFRESH_TTL = "30d" as const;
export const AUTH_OTP_TTL = "10m" as const;
export const AUTH_RESET_TTL = "30m" as const;

function required(config: ConfigService, name: string): string {
  const value = config.get<string>(name)?.trim();
  if (!value || /placeholder|replace-me|not-for-deploy/i.test(value)) {
    throw new Error(`${name} is required and must not be a placeholder`);
  }
  return value;
}

export function resolveJwtSecret(config: ConfigService): string {
  return required(config, "JWT_SECRET");
}

export function resolveJwtIssuer(config: ConfigService): string {
  return required(config, "JWT_ISSUER");
}

export function resolveJwtAudience(config: ConfigService): string {
  return required(config, "JWT_AUDIENCE");
}

export function resolveOtpPepper(config: ConfigService): string {
  return required(config, "AUTH_OTP_PEPPER");
}

export function durationToMs(value: string, fallback: string): number {
  const match = (value.trim() || fallback).match(/^(\d+)(s|m|h|d)$/);
  if (!match) throw new Error(`Invalid duration: ${value}`);
  const count = Number(match[1]);
  const factors = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return count * factors[match[2] as keyof typeof factors];
}

export function accessTtl(config: ConfigService): string {
  return config.get<string>("JWT_ACCESS_TTL")?.trim() || JWT_EXPIRES_IN;
}

export function refreshTtlMs(config: ConfigService): number {
  return durationToMs(
    config.get<string>("AUTH_REFRESH_TTL") ?? AUTH_REFRESH_TTL,
    AUTH_REFRESH_TTL,
  );
}

export function resetTtlMs(config: ConfigService): number {
  return durationToMs(
    config.get<string>("AUTH_RESET_TTL") ?? AUTH_RESET_TTL,
    AUTH_RESET_TTL,
  );
}
