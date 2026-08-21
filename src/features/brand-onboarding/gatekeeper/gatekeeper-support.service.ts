import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class GatekeeperSupportService {
  constructor(private readonly config: ConfigService) {}

  destination(): {
    support: { type: "URL"; href: string };
  } {
    const configured = this.config
      .get<string>("GATEKEEPER_SUPPORT_URL")
      ?.trim();
    if (!configured) {
      throw this.unavailable();
    }

    try {
      const url = new URL(configured);
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new Error("unsupported protocol");
      }
      return { support: { type: "URL", href: url.toString() } };
    } catch {
      throw this.unavailable();
    }
  }

  private unavailable(): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code: "GATEKEEPER_SUPPORT_NOT_CONFIGURED",
      message: "The Gatekeeper support destination is unavailable.",
    });
  }
}
