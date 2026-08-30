import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  AuthMethodType,
  EmailOtpPurpose,
  Prisma,
  SecurityEventType,
  UserAuthState,
  UserRole,
} from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { MailService } from "../../../mail/mail.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { hashPasswordAsync } from "../../../shared/crypto/password.util";
import { normalizeEmail } from "../../../shared/identity/normalize-email";
import { AuthService } from "../../auth/auth.service";
import { EmailOtpService } from "../../auth/email-otp.service";
import { GoogleAuthService } from "../../auth/google-auth.service";
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
  type EffectiveTeamInvitationStatus,
  effectiveTeamInvitationStatus,
  reconcileExpiredTeamInvitations,
  TEAM_INVITATION_STATUS,
} from "../team/team-invitation-lifecycle";
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
    private readonly googleAuth: GoogleAuthService,
    private readonly emailOtp: EmailOtpService,
  ) {}

  async create(actor: AuthUser, input: InviteTeamMemberInput) {
    const { brandProfileId } = await this.access.resolveBrandContext(actor);
    const email = input.email.trim().toLowerCase();
    const outcome = await this.prisma.$transaction(
      async (tx) => {
        await lockBrandTeam(tx, brandProfileId);
        const now = new Date();
        await reconcileExpiredTeamInvitations(tx, brandProfileId, now);
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
        if (
          await tx.teamInvitation.findFirst({
            where: {
              brandProfileId,
              email: { equals: email, mode: "insensitive" },
              status: TEAM_INVITATION_STATUS.PENDING,
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
          where: {
            brandProfileId,
            status: TEAM_INVITATION_STATUS.PENDING,
            expiresAt: { gt: now },
          },
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
    return outcome;
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

  private throwTerminalInvitation(state: EffectiveTeamInvitationStatus): never {
    if (state === TEAM_INVITATION_STATUS.ACCEPTED)
      throw new ConflictException({
        code: "INVITATION_CONSUMED",
        message: "This invitation has already been accepted.",
      });
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
    const initial = await this.lookup(this.prisma, raw);
    const outcome = await this.prisma.$transaction(async (tx) => {
      await lockBrandTeam(tx, initial.brandProfileId);
      const capturedNow = new Date();
      await reconcileExpiredTeamInvitations(
        tx,
        initial.brandProfileId,
        capturedNow,
      );
      const invite = await this.lookup(tx, raw);
      const state = effectiveTeamInvitationStatus(invite, capturedNow);
      if (state !== TEAM_INVITATION_STATUS.PENDING)
        return { kind: "TERMINAL" as const, state };
      const brand = await tx.brandProfile.findUniqueOrThrow({
        where: { id: invite.brandProfileId },
      });
      if (!brand.organizationId)
        throw new ConflictException("Brand workspace is not activated");
      const user = await this.recipient(tx, invite.email, brand.organizationId);
      return {
        kind: "PENDING" as const,
        value: {
          brand_name: brand.name,
          email: invite.email,
          role: canonicalInvitationRole(invite.role),
          expires_at: invite.expiresAt.toISOString(),
          requires_account_bootstrap: !user,
        },
      };
    });
    if (outcome.kind === "TERMINAL")
      this.throwTerminalInvitation(outcome.state);
    return outcome.value;
  }

  async requestAcceptanceOtp(raw: string) {
    await this.inspect(raw);
    const invite = await this.lookup(this.prisma, raw);
    await this.emailOtp.issue({
      email: invite.email,
      purpose: EmailOtpPurpose.TEAM_INVITE,
      eligible: true,
      displayName: invite.email.split("@")[0] ?? "there",
    });
    return {
      message: "A verification code has been sent to the invited email.",
    };
  }

  async accept(input: AcceptTeamInvitationInput, actor?: AuthUser) {
    if (!AcceptTeamInvitationSchema.safeParse(input).success)
      throw new BadRequestException("Invalid invitation acceptance input");
    const initial = await this.lookup(this.prisma, input.token);
    const invitedEmail = normalizeEmail(initial.email);
    let googleIdentity: { sub: string; email: string } | undefined;
    let otpIdentity = false;
    if (input.googleIdToken) {
      const payload = await this.googleAuth.verifyIdTokenPayload(
        input.googleIdToken,
      );
      const providerEmail = normalizeEmail(payload.email!);
      if (providerEmail !== invitedEmail) {
        throw new ForbiddenException(
          "Google account must exactly match the invited email.",
        );
      }
      googleIdentity = { sub: payload.sub, email: providerEmail };
    }
    if (input.otpCode) {
      await this.emailOtp.consume({
        email: invitedEmail,
        purpose: EmailOtpPurpose.TEAM_INVITE,
        code: input.otpCode,
      });
      otpIdentity = true;
    }
    const bootstrapPasswordHash = input.password
      ? await hashPasswordAsync(input.password)
      : undefined;
    const outcome = await this.prisma.$transaction(
      async (tx) => {
        await lockBrandTeam(tx, initial.brandProfileId);
        const capturedNow = new Date();
        await reconcileExpiredTeamInvitations(
          tx,
          initial.brandProfileId,
          capturedNow,
        );
        const invite = await this.lookup(tx, input.token);
        const state = effectiveTeamInvitationStatus(invite, capturedNow);
        if (state !== TEAM_INVITATION_STATUS.PENDING)
          return { kind: "TERMINAL" as const, state };
        const role = canonicalInvitationRole(invite.role);
        const brand = await tx.brandProfile.findUniqueOrThrow({
          where: { id: invite.brandProfileId },
        });
        if (!brand.organizationId)
          throw new ConflictException("Brand workspace is not activated");
        const email = normalizeEmail(invite.email);
        await lockAdmissionEmail(tx, email);
        let user = await this.recipient(tx, email, brand.organizationId);
        if (!user) {
          if (!bootstrapPasswordHash && !googleIdentity && !otpIdentity)
            throw new BadRequestException(
              "Enroll a password or verify the invited Google/email identity.",
            );
          if (googleIdentity) {
            const subjectOwner = await tx.userAuthMethod.findUnique({
              where: { providerSubjectId: googleIdentity.sub },
            });
            if (subjectOwner) {
              throw new ConflictException(
                "Google identity is already linked to another account.",
              );
            }
          }
          user = await tx.user.create({
            data: {
              email,
              normalizedEmail: email,
              name: email.split("@")[0],
              role: UserRole.BRAND,
              organizationId: brand.organizationId,
              emailVerifiedAt: new Date(),
              hashedPassword: bootstrapPasswordHash,
              googleSubjectId: googleIdentity?.sub,
              authState: UserAuthState.ACTIVE,
              authMethods: {
                create: bootstrapPasswordHash
                  ? {
                      type: AuthMethodType.PASSWORD,
                      credentialHash: bootstrapPasswordHash,
                    }
                  : googleIdentity
                    ? {
                        type: AuthMethodType.GOOGLE,
                        providerSubjectId: googleIdentity.sub,
                        providerEmailNormalized: email,
                      }
                    : { type: AuthMethodType.EMAIL_OTP },
              },
            },
          });
        } else {
          const actorMatches =
            actor?.id === user.id && normalizeEmail(actor.email) === email;
          if (!actorMatches && !googleIdentity && !otpIdentity) {
            throw new ForbiddenException(
              "Sign in as the invited account before accepting this invitation.",
            );
          }
          if (googleIdentity) {
            const userGoogle = await tx.userAuthMethod.findUnique({
              where: {
                userId_type: { userId: user.id, type: AuthMethodType.GOOGLE },
              },
            });
            if (
              userGoogle?.providerSubjectId &&
              userGoogle.providerSubjectId !== googleIdentity.sub
            ) {
              throw new ConflictException(
                "This account is linked to a different Google identity.",
              );
            }
            const subjectOwner = await tx.userAuthMethod.findUnique({
              where: { providerSubjectId: googleIdentity.sub },
            });
            if (subjectOwner && subjectOwner.userId !== user.id) {
              throw new ConflictException(
                "Google identity is already linked to another account.",
              );
            }
            await tx.userAuthMethod.upsert({
              where: {
                userId_type: { userId: user.id, type: AuthMethodType.GOOGLE },
              },
              create: {
                userId: user.id,
                type: AuthMethodType.GOOGLE,
                providerSubjectId: googleIdentity.sub,
                providerEmailNormalized: email,
              },
              update: {
                providerSubjectId: googleIdentity.sub,
                providerEmailNormalized: email,
                verifiedAt: new Date(),
                disabledAt: null,
              },
            });
            await tx.securityEvent.create({
              data: {
                userId: user.id,
                type: SecurityEventType.GOOGLE_LINKED,
              },
            });
          } else if (otpIdentity) {
            await tx.userAuthMethod.upsert({
              where: {
                userId_type: {
                  userId: user.id,
                  type: AuthMethodType.EMAIL_OTP,
                },
              },
              create: { userId: user.id, type: AuthMethodType.EMAIL_OTP },
              update: { verifiedAt: new Date(), disabledAt: null },
            });
          }
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
            status: TEAM_INVITATION_STATUS.PENDING,
            expiresAt: { gt: capturedNow },
          },
          data: { status: TEAM_INVITATION_STATUS.ACCEPTED },
        });
        if (consumed.count !== 1)
          throw new ConflictException("Invitation cannot be consumed");
        return {
          kind: "ADMITTED" as const,
          value: {
            userId: user.id,
            brandProfileId: brand.id,
            organizationId: brand.organizationId,
          },
        };
      },
      { timeout: 15_000 },
    );
    if (outcome.kind === "TERMINAL")
      this.throwTerminalInvitation(outcome.state);
    const { userId, ...workspace } = outcome.value;
    return {
      ...(await this.auth.issueTokenForUserId(userId)),
      ...workspace,
    };
  }
}
