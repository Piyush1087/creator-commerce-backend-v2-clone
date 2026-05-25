import { ForbiddenException } from "@nestjs/common";

import { BrandScanGateException } from "./brand-scan-gate.service";

/** Maps scan-gate failures to structured 403 bodies for the frontend. */
export function throwBrandScanGateHttp(err: unknown): void {
  if (!(err instanceof BrandScanGateException)) {
    throw err;
  }
  const { gate } = err;
  if (gate.kind === "org_claimed") {
    throw new ForbiddenException({
      outcome: "org_claimed",
      message: gate.message,
      domain: gate.domain,
      adminEmail: gate.adminEmail,
    });
  }
  if (gate.kind === "brand_active") {
    throw new ForbiddenException({
      outcome: "brand_active",
      message: gate.message,
      domain: gate.domain,
    });
  }
  if (gate.kind === "verification_required") {
    throw new ForbiddenException({
      outcome: "verification_required",
      message: gate.message,
      domain: gate.domain,
      brandProfileId: gate.brandProfileId,
      reason: gate.reason,
    });
  }
  if (err instanceof Error) {
    throw err;
  }
  throw new Error("Surface scan blocked");
}
