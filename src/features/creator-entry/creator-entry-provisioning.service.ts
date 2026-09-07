import { ConflictException, Injectable } from "@nestjs/common";
import {
  AuthMethodType,
  CreatorTeamRole,
  EmailOtpPurpose,
  OrganizationKind,
  Prisma,
  SecurityEventType,
  UserAuthState,
  UserRole,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import {
  inspectSterileProvisionalCreator,
  lockCanonicalIdentityEmail,
} from "../../shared/identity/sterile-provisional-creator.policy";
import { CREATOR_ENTRY_ERROR } from "./creator-entry.types";

type VerifiedGoogleIdentity = {
  subject: string;
  email: string;
  name: string;
};

class GoogleProvisioningConflict extends Error {
  constructor(
    readonly userId: string,
    readonly reasonCode: string,
  ) {
    super(reasonCode);
  }
}

@Injectable()
export class CreatorEntryProvisioningService {
  constructor(private readonly prisma: PrismaService) {}

  async provisionVerifiedPassword(
    userId: string,
    normalizedEmail: string,
  ): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      await lockCanonicalIdentityEmail(tx, normalizedEmail);
      const user = await tx.user.findUnique({
        where: { id: userId },
        include: {
          authMethods: {
            where: { type: AuthMethodType.PASSWORD, disabledAt: null },
          },
        },
      });
      if (!user || user.normalizedEmail !== normalizedEmail) {
        this.recoveryRequired();
      }
      const inspection = await inspectSterileProvisionalCreator(tx, user.id);
      if (!inspection.sterile || !user.authMethods[0]?.credentialHash) {
        this.recoveryRequired();
      }

      await this.createCanonicalContext(tx, {
        userId: user.id,
        normalizedEmail,
        displayName: user.name ?? this.displayName(normalizedEmail),
      });
      await tx.userAuthMethod.upsert({
        where: {
          userId_type: { userId: user.id, type: AuthMethodType.EMAIL_OTP },
        },
        create: { userId: user.id, type: AuthMethodType.EMAIL_OTP },
        update: { verifiedAt: new Date(), disabledAt: null },
      });
      await this.assertCanonicalContext(tx, user.id);
      return user.id;
    });
  }

  async provisionOrResolveGoogle(
    identity: VerifiedGoogleIdentity,
  ): Promise<string> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await lockCanonicalIdentityEmail(tx, identity.email);
        const subjectMethod = await tx.userAuthMethod.findUnique({
          where: { providerSubjectId: identity.subject },
          include: { user: true },
        });
        const emailUser = await tx.user.findUnique({
          where: { normalizedEmail: identity.email },
          include: {
            authMethods: { where: { type: AuthMethodType.GOOGLE } },
          },
        });

        if (subjectMethod) {
          if (
            subjectMethod.type !== AuthMethodType.GOOGLE ||
            subjectMethod.disabledAt ||
            subjectMethod.user.normalizedEmail !== identity.email ||
            (emailUser && emailUser.id !== subjectMethod.userId)
          ) {
            throw new GoogleProvisioningConflict(
              subjectMethod.userId,
              "GOOGLE_SUBJECT_OWNERSHIP_CONFLICT",
            );
          }
          if (
            subjectMethod.user.authState !== UserAuthState.ACTIVE ||
            subjectMethod.user.role !== UserRole.CREATOR
          ) {
            this.accountContextConflict();
          }
          await this.assertCanonicalContext(tx, subjectMethod.userId);
          return subjectMethod.userId;
        }

        if (!emailUser) {
          return this.createGoogleCreator(tx, identity);
        }
        if (emailUser.authState === UserAuthState.ACTIVE) {
          if (emailUser.role !== UserRole.CREATOR) {
            this.accountContextConflict();
          }
          const existingGoogle = emailUser.authMethods[0];
          if (
            (existingGoogle?.providerSubjectId &&
              existingGoogle.providerSubjectId !== identity.subject) ||
            (emailUser.googleSubjectId &&
              emailUser.googleSubjectId !== identity.subject)
          ) {
            throw new GoogleProvisioningConflict(
              emailUser.id,
              "EMAIL_LINKED_TO_DIFFERENT_GOOGLE_SUBJECT",
            );
          }
          await this.assertCanonicalContext(tx, emailUser.id);
          await this.linkGoogleIdentity(tx, emailUser.id, identity);
          return emailUser.id;
        }

        const inspection = await inspectSterileProvisionalCreator(
          tx,
          emailUser.id,
        );
        if (!inspection.sterile) this.recoveryRequired();
        await this.linkGoogleIdentity(tx, emailUser.id, identity);
        await tx.emailOtpChallenge.updateMany({
          where: {
            normalizedEmail: identity.email,
            purpose: EmailOtpPurpose.CREATOR_EMAIL_VERIFICATION,
            consumedAt: null,
            supersededAt: null,
          },
          data: { supersededAt: new Date() },
        });
        await this.createCanonicalContext(tx, {
          userId: emailUser.id,
          normalizedEmail: identity.email,
          displayName: emailUser.name ?? identity.name,
        });
        await this.assertCanonicalContext(tx, emailUser.id);
        return emailUser.id;
      });
    } catch (error) {
      if (error instanceof GoogleProvisioningConflict) {
        await this.recordGoogleConflict(error.userId, error.reasonCode);
        this.googleConflict();
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const owner = await this.prisma.user.findFirst({
          where: {
            OR: [
              { normalizedEmail: identity.email },
              { googleSubjectId: identity.subject },
              {
                authMethods: {
                  some: { providerSubjectId: identity.subject },
                },
              },
            ],
          },
          select: { id: true },
        });
        if (owner) {
          await this.recordGoogleConflict(owner.id, "GOOGLE_LINK_RACE");
        }
        this.googleConflict();
      }
      throw error;
    }
  }

  private async createGoogleCreator(
    tx: Prisma.TransactionClient,
    identity: VerifiedGoogleIdentity,
  ): Promise<string> {
    const organization = await tx.organization.create({
      data: {
        name: `${identity.name}'s Studio`,
        kind: OrganizationKind.CREATOR,
      },
    });
    const user = await tx.user.create({
      data: {
        email: identity.email,
        normalizedEmail: identity.email,
        name: identity.name,
        role: UserRole.CREATOR,
        authState: UserAuthState.ACTIVE,
        emailVerifiedAt: new Date(),
        organizationId: organization.id,
        googleSubjectId: identity.subject,
        authMethods: {
          create: {
            type: AuthMethodType.GOOGLE,
            providerSubjectId: identity.subject,
            providerEmailNormalized: identity.email,
          },
        },
      },
    });
    await tx.securityEvent.create({
      data: { userId: user.id, type: SecurityEventType.GOOGLE_LINKED },
    });
    await this.createProfileWorkspaceAndOwner(tx, {
      userId: user.id,
      organizationId: organization.id,
      normalizedEmail: identity.email,
      displayName: identity.name,
    });
    await this.assertCanonicalContext(tx, user.id);
    return user.id;
  }

  private async createCanonicalContext(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      normalizedEmail: string;
      displayName: string;
    },
  ): Promise<void> {
    const organization = await tx.organization.create({
      data: {
        name: `${input.displayName}'s Studio`,
        kind: OrganizationKind.CREATOR,
      },
    });
    await tx.user.update({
      where: { id: input.userId },
      data: {
        name: input.displayName,
        role: UserRole.CREATOR,
        authState: UserAuthState.ACTIVE,
        emailVerifiedAt: new Date(),
        organizationId: organization.id,
      },
    });
    await this.createProfileWorkspaceAndOwner(tx, {
      ...input,
      organizationId: organization.id,
    });
  }

  private async createProfileWorkspaceAndOwner(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      organizationId: string;
      normalizedEmail: string;
      displayName: string;
    },
  ): Promise<void> {
    const profile = await tx.creatorProfile.create({
      data: { userId: input.userId, displayName: input.displayName },
    });
    const workspace = await tx.creatorWorkspace.create({
      data: {
        ownerProfileId: profile.id,
        organizationId: input.organizationId,
        organizationDisplayName: `${input.displayName}'s Studio`,
      },
    });
    await tx.creatorWorkspaceMember.create({
      data: {
        workspaceId: workspace.id,
        assignedProfileId: profile.id,
        associatedEmail: input.normalizedEmail,
        securityRole: CreatorTeamRole.OWNER,
        isActive: true,
        joinedAt: new Date(),
      },
    });
  }

  private async linkGoogleIdentity(
    tx: Prisma.TransactionClient,
    userId: string,
    identity: VerifiedGoogleIdentity,
  ): Promise<void> {
    await tx.userAuthMethod.upsert({
      where: { userId_type: { userId, type: AuthMethodType.GOOGLE } },
      create: {
        userId,
        type: AuthMethodType.GOOGLE,
        providerSubjectId: identity.subject,
        providerEmailNormalized: identity.email,
      },
      update: {
        providerSubjectId: identity.subject,
        providerEmailNormalized: identity.email,
        verifiedAt: new Date(),
        disabledAt: null,
      },
    });
    await tx.user.update({
      where: { id: userId },
      data: {
        googleSubjectId: identity.subject,
        emailVerifiedAt: new Date(),
        name: identity.name,
      },
    });
    await tx.securityEvent.create({
      data: { userId, type: SecurityEventType.GOOGLE_LINKED },
    });
  }

  private async assertCanonicalContext(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<void> {
    const user = await tx.user.findUnique({
      where: { id: userId },
      include: {
        organization: true,
        creatorProfile: {
          include: {
            ownedWorkspaces: {
              include: {
                members: {
                  where: {
                    isActive: true,
                    securityRole: CreatorTeamRole.OWNER,
                  },
                },
              },
            },
          },
        },
      },
    });
    const profile = user?.creatorProfile;
    const workspaces = profile?.ownedWorkspaces ?? [];
    const workspace = workspaces[0];
    if (
      !user ||
      user.authState !== UserAuthState.ACTIVE ||
      user.role !== UserRole.CREATOR ||
      !user.organizationId ||
      user.organization?.kind !== OrganizationKind.CREATOR ||
      !profile ||
      workspaces.length !== 1 ||
      workspace.organizationId !== user.organizationId ||
      workspace.members.length !== 1 ||
      workspace.members[0].assignedProfileId !== profile.id
    ) {
      this.recoveryRequired();
    }
  }

  private async recordGoogleConflict(
    userId: string,
    reasonCode: string,
  ): Promise<void> {
    await this.prisma.securityEvent.create({
      data: {
        userId,
        type: SecurityEventType.GOOGLE_LINK_CONFLICT,
        outcome: "REJECTED",
        reasonCode,
      },
    });
  }

  private displayName(normalizedEmail: string): string {
    return normalizedEmail.split("@")[0] || "Creator";
  }

  private googleConflict(): never {
    throw new ConflictException({
      code: CREATOR_ENTRY_ERROR.GOOGLE_IDENTITY_CONFLICT,
      message: "Google identity conflicts with this account.",
    });
  }

  private accountContextConflict(): never {
    throw new ConflictException({
      code: CREATOR_ENTRY_ERROR.ACCOUNT_CONTEXT_CONFLICT,
      message: "This identity belongs to another account context.",
    });
  }

  private recoveryRequired(): never {
    throw new ConflictException({
      code: CREATOR_ENTRY_ERROR.CREATOR_CONTEXT_RECOVERY_REQUIRED,
      message: "Creator context requires recovery.",
    });
  }
}
