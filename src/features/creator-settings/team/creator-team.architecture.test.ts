import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("C05 P1B Creator Team architecture", () => {
  it("authorizes only direct active User membership", () => {
    const resolver = source(
      "src/features/creator-settings/team/creator-workspace-actor.service.ts",
    );
    expect(resolver).toContain("userId: actor.id");
    expect(resolver).toContain("isActive: true");
    expect(resolver).not.toContain("associatedEmail");
  });

  it("keeps Owner compatibility bound to canonical profile identity", () => {
    const resolver = source(
      "src/features/creator-settings/team/creator-workspace-actor.service.ts",
    );
    expect(resolver).toContain("ownerProfile: { userId: actor.id }");
    expect(resolver).toContain(
      "data: { userId: workspace.ownerProfile.userId }",
    );
    expect(resolver).toContain("owners.length !== 1");
  });

  it("serializes admission and never fabricates a User", () => {
    const invitations = source(
      "src/features/creator-settings/team/creator-team-invitations.service.ts",
    );
    const policy = source(
      "src/features/creator-settings/team/creator-team.policy.ts",
    );
    expect(policy).toMatch(/creator_workspaces[\s\S]*FOR UPDATE/);
    expect(invitations).toContain("lockCreatorTeam(tx, initial.workspaceId)");
    expect(invitations).toContain(
      "lockCanonicalIdentityEmail(tx, invitedEmail)",
    );
    expect(invitations).not.toMatch(/\b(?:tx\.)?user\.create\s*\(/);
  });

  it("persists only token hashes and blocks replay/expiry", () => {
    const invitations = source(
      "src/features/creator-settings/team/creator-team-invitations.service.ts",
    );
    expect(invitations).toContain(
      "secureTokenHash: hashTeamInvitationToken(rawToken)",
    );
    expect(invitations).toContain("INVITATION_CONSUMED");
    expect(invitations).toContain("INVITATION_EXPIRED");
    expect(invitations).not.toContain("secureTokenHash: rawToken");
  });

  it("exposes a shell-safe actor projection behind JWT authentication", () => {
    const controller = source(
      "src/features/creator-settings/team/creator-workspace-actor.controller.ts",
    );
    expect(controller).toContain('@Get("actor-context")');
    expect(controller).toContain("JwtAuthGuard");
    expect(controller).toContain("subject_creator_profile_id");
    expect(controller).toContain("allowed_actions");
  });

  it("projects canonical Organization.name without a second workspace-name authority", () => {
    const team = source(
      "src/features/creator-settings/team/creator-team.service.ts",
    );
    expect(team).toContain("organization_name: workspace.organization.name");
    expect(team).not.toContain("organizationDisplayName");
  });

  it("does not implement downstream Campaign, Collaboration, or payout behavior", () => {
    const team = [
      source("src/features/creator-settings/team/creator-team.service.ts"),
      source(
        "src/features/creator-settings/team/creator-team-invitations.service.ts",
      ),
    ].join("\n");
    expect(team).not.toMatch(
      /from ["'][^"']*(?:campaign|collaboration|payout)/i,
    );
  });
});
