import { ConfigService } from "@nestjs/config";

/** Access token lifetime for brand auth (login + complete-registration). */
export const JWT_EXPIRES_IN = "7d" as const;

/** Resolves signing key: `JWT_SECRET` if set, else stage-specific env vars. */
export function resolveJwtSecret(config: ConfigService): string {
  const direct = config.get<string>("JWT_SECRET")?.trim();
  if (direct) {
    return direct;
  }

  const stage = (config.get<string>("STAGE") ?? "local").trim().toLowerCase();
  if (stage === "prod") {
    return config.getOrThrow<string>("JWT_SECRET_PROD");
  }

  return (
    config.get<string>("JWT_SECRET_DEV")?.trim() ??
    "local-dev-jwt-secret-not-for-deploy"
  );
}
