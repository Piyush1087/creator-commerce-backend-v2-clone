import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class GatekeeperPolicyVersionService {
  constructor(private readonly config: ConfigService) {}

  authoritativeVersions(): {
    termsVersion: string;
    privacyPolicyVersion: string;
  } {
    const termsVersion = this.config
      .get<string>("GATEKEEPER_TERMS_VERSION", "")
      .trim();
    const privacyPolicyVersion = this.config
      .get<string>("GATEKEEPER_PRIVACY_POLICY_VERSION", "")
      .trim();
    if (!termsVersion || !privacyPolicyVersion) {
      throw new ServiceUnavailableException(
        "Gatekeeper policy versions are not configured on the server",
      );
    }
    return { termsVersion, privacyPolicyVersion };
  }
}
