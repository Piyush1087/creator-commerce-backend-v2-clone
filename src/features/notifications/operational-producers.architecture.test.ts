import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("BS-05 P2B operational producer boundaries", () => {
  it("keeps legacy application compatibility explicitly notification-free", () => {
    const applications = source(
      "src/features/brand-uce/services/campaign-application.service.ts",
    );
    expect(applications).toContain("syncLegacyApplicantsCompatibilityCommand");
    expect(applications).not.toContain(
      'eventType: "campaigns.application_received"',
    );
  });

  it("creates the media-review intent in the submission transaction without sensitive payload", () => {
    const collaboration = source(
      "src/features/collaboration/services/collaboration.service.ts",
    );
    const start = collaboration.indexOf("async submitMedia");
    const end = collaboration.indexOf("async reviewMedia", start);
    const method = collaboration.slice(start, end);
    expect(method).toContain(
      'eventType: "collaborations.media_submitted_for_review"',
    );
    expect(method).toContain("enqueueWithinTransaction");
    const payload = method.slice(
      method.indexOf("payload:"),
      method.indexOf("triggerUserId:"),
    );
    expect(payload).not.toContain("media_url");
    expect(payload).not.toContain("caption");
  });

  it("wires only aggregate intelligence and successful Team revocation", () => {
    const aggregation = source(
      "src/features/brand-intelligence/execution/execution-aggregation.service.ts",
    );
    const team = source(
      "src/features/brand-settings/services/brand-team.service.ts",
    );
    expect(aggregation).toContain(
      'eventType: "intelligence.execution_completed"',
    );
    expect(aggregation).toContain('eventType: "intelligence.execution_failed"');
    expect(team).toContain('eventType: "team.member_access_revoked"');
    expect(team.indexOf("brandTeamMember.update")).toBeLessThan(
      team.indexOf('eventType: "team.member_access_revoked"'),
    );
  });
});
