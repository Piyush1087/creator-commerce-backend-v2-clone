import type { ServerClient } from "postmark";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MailService } from "./mail.service";

describe("shared Team invitation mail routing", () => {
  const send = vi.fn().mockResolvedValue({
    ErrorCode: 0,
    MessageID: "fixture-message",
  });
  const mail = new MailService({
    sendEmailWithTemplate: send,
  } as unknown as ServerClient);

  beforeEach(() => {
    send.mockReset().mockResolvedValue({
      ErrorCode: 0,
      MessageID: "fixture-message",
    });
    vi.stubEnv("POSTMARK_TEAM_INVITE_TEMPLATE_ID", "1");
    vi.stubEnv("APP_FRONTEND_URL", "https://app.example.test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ["Brand", "/brand/team-invitations/accept"],
    ["Creator", "/creator/team-invitations/accept"],
  ] as const)(
    "keeps the %s bearer in the expected URL fragment",
    async (kind, path) => {
      const rawToken = `${kind.toLowerCase()}-raw-token-fixture`;
      const common = {
        email: "recipient@example.test",
        role: "ASSISTANT",
        expiresAt: new Date("2026-09-08T12:00:00.000Z"),
        rawToken,
      };
      if (kind === "Brand") {
        await mail.sendTeamInvitation({
          ...common,
          brandName: "Brand workspace",
        });
      } else {
        await mail.sendCreatorTeamInvitation({
          ...common,
          workspaceName: "Creator workspace",
        });
      }
      const payload = send.mock.calls[0][0] as {
        TemplateModel: { acceptance_url: string };
        TrackLinks: string;
        TrackOpens: boolean;
      };
      const url = new URL(payload.TemplateModel.acceptance_url);
      expect(url.pathname).toBe(path);
      expect(url.search).toBe("");
      expect(new URLSearchParams(url.hash.slice(1)).get("token")).toBe(
        rawToken,
      );
      expect(payload.TrackOpens).toBe(false);
    },
  );
});
