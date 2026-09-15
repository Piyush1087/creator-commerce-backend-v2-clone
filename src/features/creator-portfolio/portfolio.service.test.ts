import { describe, it, expect, vi } from "vitest";
import { creatorWorkspaceActionsForRole } from "../creator-settings/team/creator-team.policy";
import { PortfolioService } from "./portfolio.service";
import type { PortfolioRepository } from "./portfolio.repository";
import { portfolioReference } from "./testing/portfolio.fixture";
import type { AuthUser } from "../auth/types/auth-user";
const user = {
  id: "fixture",
  email: "fixture@example.test",
  name: null,
  organizationId: null,
  role: "CREATOR",
} as AuthUser;
describe("Portfolio strict service and role seams", () => {
  it.each(["OWNER", "MANAGER", "ASSISTANT"] as const)(
    "extends only Portfolio authority for %s",
    (role) => {
      const actions = creatorWorkspaceActionsForRole(role);
      expect(actions).toContain("PORTFOLIO_READ");
      expect(actions.includes("PORTFOLIO_CURATE")).toBe(role !== "ASSISTANT");
    },
  );
  it("rejects subject, verified facts, upload and deletion command before repository mutation", () => {
    const repository = { read: vi.fn(), mutate: vi.fn() };
    const service = new PortfolioService(
      repository as unknown as PortfolioRepository,
    );
    for (const extra of [
      { ownerProfileId: "other" },
      { instagramVerified: true },
      { upload: true },
      { intent: "DELETE_MY_DATA" },
    ])
      expect(() =>
        service.mutate(user, { ...portfolioReference(), ...extra }),
      ).toThrow();
    expect(repository.mutate).not.toHaveBeenCalled();
  });
  it("rejects query subject override, unknown filter and foreign cursor shape", () => {
    const service = new PortfolioService({
      read: vi.fn(),
    } as unknown as PortfolioRepository);
    for (const query of [
      { workspaceId: "other" },
      { filter: "PROJECT" },
      { cursor: "other" },
    ])
      expect(() => service.read(user, query)).toThrow();
  });
  it("passes only normalized permitted reference fields to owning capability", () => {
    const repository = { mutate: vi.fn() };
    const service = new PortfolioService(
      repository as unknown as PortfolioRepository,
    );
    const command = { ...portfolioReference(), title: "  One   reference " };
    service.mutate(user, command);
    expect(repository.mutate).toHaveBeenCalledWith(user, {
      ...command,
      title: "One reference",
    });
  });
});
