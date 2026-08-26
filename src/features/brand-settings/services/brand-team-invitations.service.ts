import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma, UserRole, type TeamInvitation } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { MailService } from "../../../mail/mail.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { AuthService } from "../../auth/auth.service";
import type { AuthUser } from "../../auth/types/auth-user";
import type { InviteTeamMemberInput } from "../schemas/brand-settings.schema";
import {
  AcceptTeamInvitationSchema,
  InvitationTokenSchema,
  type AcceptTeamInvitationInput,
} from "../schemas/team-invitation.schema";
import {
  assertTeamAuthority,
  canonicalInvitationRole,
  lockAdmissionEmail,
  lockBrandTeam,
  requireTeamActor,
} from "../team/brand-team-policy";
import {
  BRAND_SETTINGS_MAX_SEATS,
  BrandSettingsAccessService,
} from "./brand-settings-access.service";

export function hashInvitationToken(raw: string) {
  return `sha256:${createHash("sha256").update(raw).digest("hex")}`;
}

@Injectable()
export class BrandTeamInvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BrandSettingsAccessService,
    private readonly auth: AuthService,
    private readonly mail: MailService,
  ) {}

  async create(actor: AuthUser, input: InviteTeamMemberInput) {
    const { brandProfileId } = await this.access.resolveBrandContext(actor);
    const email = input.email.trim().toLowerCase();
    return this.prisma.$transaction(
      async (tx) => {
        await lockBrandTeam(tx, brandProfileId);
        const member = await requireTeamActor(tx, brandProfileId, actor);
        assertTeamAuthority(member.role, undefined, input.role);
        const brand = await tx.brandProfile.findUniqueOrThrow({
          where: { id: brandProfileId },
        });
        if (!brand.organizationId)
          throw new ConflictException("Brand workspace is not activated");
        if (
          await tx.brandTeamMember.findFirst({
            where: {
              brandProfileId,
              isActive: true,
              user: { email: { equals: email, mode: "insensitive" } },
            },
          })
        ) {
          throw new ConflictException(
            "This email is already an active workspace member.",
          );
        }
        const now = new Date();
        if (
          await tx.teamInvitation.findFirst({
            where: {
              brandProfileId,
              email: { equals: email, mode: "insensitive" },
              status: "PENDING",
              expiresAt: { gt: now },
            },
          })
        ) {
          throw new ConflictException(
            "A pending invitation already exists for this email.",
          );
        }
        const active = await tx.brandTeamMember.count({
          where: { brandProfileId, isActive: true },
        });
        const pending = await tx.teamInvitation.count({
          where: { brandProfileId, status: "PENDING", expiresAt: { gt: now } },
        });
        if (active + pending >= BRAND_SETTINGS_MAX_SEATS)
          throw new BadRequestException(
            "Workspace seat capacity fully exhausted (5/5). Revoke a member or cancel a pending invitation.",
          );
        const rawToken = randomBytes(32).toString("hex");
        const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const invitation = await tx.teamInvitation.create({
          data: {
            brandProfileId,
            email,
            role: input.role,
            token: hashInvitationToken(rawToken),
            expiresAt,
          },
        });
        try {
          await this.mail.sendTeamInvitation({
            email,
            brandName: brand.name,
            role: input.role,
            expiresAt,
            rawToken,
          });
        } catch {
          // Do not propagate provider errors: they can echo the token-bearing payload.
          // Throwing rolls back the invite. A late delivery carries an invalid token.
          throw new ServiceUnavailableException(
            "Invitation email could not be dispatched. No active invitation was created; please try again.",
          );
        }
        return {
          invitation_id: invitation.id,
          email,
          role: input.role,
          expires_at: expiresAt.toISOString(),
          delivery_status: "DISPATCHED" as const,
        };
      },
      { timeout: 20_000 },
    );
  }

  private async lookup(tx: Prisma.TransactionClient, raw: string) {
    if (!InvitationTokenSchema.safeParse(raw).success)
      throw new NotFoundException({
        code: "INVITATION_INVALID",
        message: "Invalid invitation",
      });
    const invite = await tx.teamInvitation.findFirst({
      where: { OR: [{ token: hashInvitationToken(raw) }, { token: raw }] },
    });
    if (!invite)
      throw new NotFoundException({
        code: "INVITATION_INVALID",
        message: "Invalid invitation",
      });
    return invite;
  }

  private assertPending(invite: TeamInvitation) {
    if (invite.status === "ACCEPTED")
      throw new ConflictException({
        code: "INVITATION_CONSUMED",
        message: "This invitation has already been accepted.",
      });
    if (invite.status !== "PENDING" || invite.expiresAt.getTime() <= Date.now())
      throw new GoneException({
        code: "INVITATION_EXPIRED",
        message: "This invitation has expired or was cancelled.",
      });
  }

  private async recipient(
    tx: Prisma.TransactionClient,
    email: string,
    organizationId: string,
  ) {
    const matches = await tx.user.findMany({
      where: { email: { equals: email.trim(), mode: "insensitive" } },
    });
    if (matches.length > 1)
      throw new ConflictException(
        "Invitation email matches multiple accounts; contact support.",
      );
    const user = matches[0];
    if (
      user &&
      (user.role !== UserRole.BRAND ||
        (user.organizationId && user.organizationId !== organizationId))
    )
      throw new ForbiddenException(
        "This account cannot join the invited Brand workspace.",
      );
    return user;
  }

  async inspect(raw: string) {
    const invite = await this.lookup(this.prisma, raw);
    this.assertPending(invite);
    const brand = await this.prisma.brandProfile.findUniqueOrThrow({
      where: { id: invite.brandProfileId },
    });
    if (!brand.organizationId)
      throw new ConflictException("Brand workspace is not activated");
    const user = await this.recipient(
      this.prisma,
      invite.email,
      brand.organizationId,
    );
    return {
      brand_name: brand.name,
      email: invite.email,
      role: canonicalInvitationRole(invite.role),
      expires_at: invite.expiresAt.toISOString(),
      requires_account_bootstrap: !user,
    };
  }

  async accept(input: AcceptTeamInvitationInput) {
    if (!AcceptTeamInvitationSchema.safeParse(input).success)
      throw new BadRequestException("Invalid invitation acceptance input");
    const initial = await this.lookup(this.prisma, input.token);
    return this.prisma.$transaction(
      async (tx) => {
        await lockBrandTeam(tx, initial.brandProfileId);
        const invite = await this.lookup(tx, input.token);
        this.assertPending(invite);
        const role = canonicalInvitationRole(invite.role);
        const brand = await tx.brandProfile.findUniqueOrThrow({
          where: { id: invite.brandProfileId },
        });
        if (!brand.organizationId)
          throw new ConflictException("Brand workspace is not activated");
        const email = invite.email.trim().toLowerCase();
        await lockAdmissionEmail(tx, email);
        let user = await this.recipient(tx, email, brand.organizationId);
        if (!user) {
          if (!input.password)
            throw new BadRequestException(
              "An initial password is required for this invitation.",
            );
          user = await tx.user.create({
            data: {
              email,
              name: email.split("@")[0],
              role: UserRole.BRAND,
              organizationId: brand.organizationId,
              emailVerifiedAt: new Date(),
              hashedPassword: this.auth.hashPassword(input.password),
            },
          });
        } else {
          const associated = await tx.user.updateMany({
            where: {
              id: user.id,
              role: UserRole.BRAND,
              OR: [
                { organizationId: null },
                { organizationId: brand.organizationId },
              ],
            },
            data: {
              organizationId: brand.organizationId,
              emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
            },
          });
          if (associated.count !== 1)
            throw new ConflictException(
              "Account organization changed; invitation cannot be accepted.",
            );
          user = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
        }
        const existing = await tx.brandTeamMember.findUnique({
          where: {
            brandProfileId_userId: {
              brandProfileId: brand.id,
              userId: user.id,
            },
          },
        });
        // A legacy pending invite must not demote/promote an already admitted user.
        if (!existing?.isActive) {
          const active = await tx.brandTeamMember.count({
            where: { brandProfileId: brand.id, isActive: true },
          });
          if (active >= BRAND_SETTINGS_MAX_SEATS)
            throw new ConflictException(
              "Workspace seat capacity fully exhausted. Contact a workspace administrator.",
            );
          await tx.brandTeamMember.upsert({
            where: {
              brandProfileId_userId: {
                brandProfileId: brand.id,
                userId: user.id,
              },
            },
            create: {
              brandProfileId: brand.id,
              userId: user.id,
              role,
              isActive: true,
            },
            update: { role, isActive: true },
          });
        }
        const consumed = await tx.teamInvitation.updateMany({
          where: {
            id: invite.id,
            status: "PENDING",
            expiresAt: { gt: new Date() },
          },
          data: { status: "ACCEPTED" },
        });
        if (consumed.count !== 1)
          throw new ConflictException("Invitation cannot be consumed");
        // Signing failure rolls back admission too. Reuse the existing AuthService.
        return {
          ...(await this.auth.issueTokenForUser(user)),
          brandProfileId: brand.id,
          organizationId: brand.organizationId,
        };
      },
      { timeout: 15_000 },
    );
  }
}
