import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface OfferingPriceRefreshConfig {
  readonly enabled: boolean;
  readonly scanIntervalMinutes: number;
  readonly refreshIntervalHours: number;
  readonly batchSize: number;
}

@Injectable()
export class OfferingPriceRefreshConfigService {
  private readonly logger = new Logger(OfferingPriceRefreshConfigService.name);

  constructor(private readonly config: ConfigService) {}

  read(): OfferingPriceRefreshConfig {
    const enabled =
      (this.config.get<string>("OFFERING_PRICE_REFRESH_ENABLED") ?? "true")
        .trim()
        .toLowerCase() !== "false";
    const scanIntervalMinutes = this.integer(
      "OFFERING_PRICE_REFRESH_SCAN_INTERVAL_MINUTES",
      60,
      1,
      1440,
    );
    const refreshIntervalHours = this.integer(
      "OFFERING_PRICE_REFRESH_INTERVAL_HOURS",
      24,
      1,
      24 * 30,
    );
    const batchSize = this.integer(
      "OFFERING_PRICE_REFRESH_BATCH_SIZE",
      20,
      1,
      100,
    );
    const valid =
      scanIntervalMinutes !== null &&
      refreshIntervalHours !== null &&
      batchSize !== null;
    if (!valid && enabled) {
      this.logger.error(
        "Offering price refresh disabled because configuration is invalid",
      );
    }
    return {
      enabled: enabled && valid,
      scanIntervalMinutes: scanIntervalMinutes ?? 60,
      refreshIntervalHours: refreshIntervalHours ?? 24,
      batchSize: batchSize ?? 20,
    };
  }

  private integer(
    name: string,
    fallback: number,
    minimum: number,
    maximum: number,
  ): number | null {
    const raw = this.config.get<string>(name);
    if (raw == null || raw.trim() === "") return fallback;
    const value = Number(raw);
    return Number.isInteger(value) && value >= minimum && value <= maximum
      ? value
      : null;
  }
}
