import type { ConfigService } from "@nestjs/config";

type StageConfig = Pick<ConfigService, "get">;

export function resolveRuntimeStage(config?: StageConfig): string {
  return (config?.get<string>("STAGE") ?? process.env.STAGE ?? "")
    .trim()
    .toLowerCase();
}

/** SST `--stage prod` is the only stage that must not print OTP codes. */
export function isProductionStage(stage = resolveRuntimeStage()): boolean {
  return stage === "prod";
}

/**
 * Testers read `[OTP]` from Nest / CloudWatch on local and AWS `--stage dev`.
 * Unset STAGE is treated as non-prod so local smoke still logs.
 */
export function shouldLogOtpCodes(config?: StageConfig): boolean {
  return !isProductionStage(resolveRuntimeStage(config));
}
