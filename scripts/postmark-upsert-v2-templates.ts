/**
 * One-shot: upsert Postmark *-v2 templates from docs/charters/postmark/templates.
 * Uses POSTMARK_SERVER_TOKEN from gitignored .env. Does not send live email.
 * Does not attach Layout `basic` / `basic-2` (v2 HTML is self-contained).
 *
 * Usage: npx ts-node -r dotenv/config scripts/postmark-upsert-v2-templates.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { Models, ServerClient } from "postmark";

type Spec = {
  alias: string;
  name: string;
  subject: string;
  htmlFile: string;
  textFile: string;
  sampleModel: Record<string, string | number>;
};

const ROOT = path.resolve(__dirname, "..");
const TEMPLATES = path.join(ROOT, "docs/charters/postmark/templates");

const SPECS: Spec[] = [
  {
    alias: "auth-otp-v2",
    name: "Auth OTP v2",
    subject: "Your Creator Shop code is {{otp}}",
    htmlFile: "auth-otp-v2.html",
    textFile: "auth-otp-v2.txt",
    sampleModel: {
      name: "Alex",
      otp: "482917",
      expires_in_minutes: 10,
    },
  },
  {
    alias: "password-reset-v2",
    name: "Password reset v2",
    subject: "Reset your Creator Shop password",
    htmlFile: "password-reset-v2.html",
    textFile: "password-reset-v2.txt",
    sampleModel: {
      name: "Alex",
      reset_url:
        "https://dashboard.dev.thecreatorshop.in/reset-password#token=sample",
      expires_in_minutes: 30,
    },
  },
  {
    alias: "team-invite-v2",
    name: "Team invite v2",
    subject: "You're invited to join {{brand_name}}",
    htmlFile: "team-invite-v2.html",
    textFile: "team-invite-v2.txt",
    sampleModel: {
      brand_name: "The Collection India",
      invited_role: "Manager",
      expires_at: "2026-09-25T12:00:00.000Z",
      acceptance_url:
        "https://dashboard.dev.thecreatorshop.in/brand/team-invitations/accept#token=sample",
    },
  },
  {
    alias: "notification-default-v2",
    name: "Notification default v2",
    subject: "{{title}}",
    htmlFile: "notification-default-v2.html",
    textFile: "notification-default-v2.txt",
    sampleModel: {
      name: "Alex",
      title: "Invoice ready",
      body: "Your invoice is ready to view.",
      action_url: "https://dashboard.dev.thecreatorshop.in/brand/billing",
      event_type: "billing.invoice_ready",
    },
  },
];

async function upsertTemplate(
  client: ServerClient,
  spec: Spec,
  HtmlBody: string,
  TextBody: string,
): Promise<number> {
  let exists = false;
  try {
    await client.getTemplate(spec.alias);
    exists = true;
  } catch {
    exists = false;
  }

  if (exists) {
    const edited = await client.editTemplate(spec.alias, {
      Name: spec.name,
      Subject: spec.subject,
      HtmlBody,
      TextBody,
    });
    return edited.TemplateId;
  }

  const created = await client.createTemplate({
    Name: spec.name,
    Alias: spec.alias,
    Subject: spec.subject,
    HtmlBody,
    TextBody,
    TemplateType: Models.TemplateTypes.Standard,
  });
  return created.TemplateId;
}

async function main(): Promise<void> {
  const token = process.env.POSTMARK_SERVER_TOKEN?.trim();
  if (!token) {
    throw new Error("POSTMARK_SERVER_TOKEN missing in env");
  }

  const client = new ServerClient(token);
  const results: Array<{ alias: string; templateId: number }> = [];

  for (const spec of SPECS) {
    const HtmlBody = fs.readFileSync(
      path.join(TEMPLATES, spec.htmlFile),
      "utf8",
    );
    const TextBody = fs.readFileSync(
      path.join(TEMPLATES, spec.textFile),
      "utf8",
    );

    const templateId = await upsertTemplate(client, spec, HtmlBody, TextBody);

    const validated = await client.validateTemplate({
      Subject: spec.subject,
      HtmlBody,
      TextBody,
      TestRenderModel: spec.sampleModel,
    });
    if (!validated.AllContentIsValid) {
      throw new Error(
        `Validate failed for ${spec.alias}: ${JSON.stringify(validated)}`,
      );
    }

    results.push({ alias: spec.alias, templateId });
    // eslint-disable-next-line no-console
    console.log(`OK ${spec.alias} TemplateId=${templateId}`);
  }

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        POSTMARK_AUTH_OTP_TEMPLATE_ID: results.find(
          (r) => r.alias === "auth-otp-v2",
        )?.templateId,
        POSTMARK_PASSWORD_RESET_TEMPLATE_ID: results.find(
          (r) => r.alias === "password-reset-v2",
        )?.templateId,
        POSTMARK_TEAM_INVITE_TEMPLATE_ID: results.find(
          (r) => r.alias === "team-invite-v2",
        )?.templateId,
        POSTMARK_NOTIFICATION_DEFAULT_TEMPLATE_ID: results.find(
          (r) => r.alias === "notification-default-v2",
        )?.templateId,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
