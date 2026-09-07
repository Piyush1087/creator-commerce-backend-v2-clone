import { describe, expect, it } from "vitest";

import {
  generateTeamInvitationToken,
  hashTeamInvitationToken,
  teamInvitationDigestCandidates,
} from "./team-invitation-token";

describe("shared Team invitation token", () => {
  it("generates a high-entropy bearer token and persists only its digest", () => {
    const raw = generateTeamInvitationToken();
    const stored = hashTeamInvitationToken(raw);
    expect(raw).toMatch(/^[a-f0-9]{64}$/);
    expect(stored).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(stored).not.toContain(raw);
  });

  it("supports only prefixed and legacy digest lookup candidates", () => {
    const raw = "a".repeat(64);
    const candidates = teamInvitationDigestCandidates(raw);
    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toBe(hashTeamInvitationToken(raw));
    expect(candidates).not.toContain(raw);
    expect(candidates[0]).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(candidates[1]).toMatch(/^[a-f0-9]{64}$/);
  });
});
