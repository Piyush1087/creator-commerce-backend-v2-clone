import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CollaborationEscrowStatus,
  EscrowTransactionType,
  UserRole,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
import { BrandCentreAuthService } from "../../brand-centre/brand-centre-auth.service";
import { decimalToNumber } from "../../brand-uce/utils/uce-decimal.util";
import { COLLABORATION_THREAD_INCLUDE } from "../../collaboration/services/collaboration-access.service";
import { mapEscrowVault } from "../../brand-escrow/utils/map-escrow-vault.util";

const ACTIVE_ESCROW_STATUSES: CollaborationEscrowStatus[] = [
  CollaborationEscrowStatus.FUNDED,
  CollaborationEscrowStatus.PARTIAL_RELEASE,
];

const DISBURSAL_TYPES = new Set<EscrowTransactionType>([
  EscrowTransactionType.TRANCHE_ADVANCE_RELEASE,
  EscrowTransactionType.TRANCHE_FINAL_RELEASE,
]);

function resolveCreatorHandle(row: {
  creatorUser: {
    name: string | null;
    email: string;
    creatorProfile: {
      displayName: string | null;
      instagramHandle: string | null;
    } | null;
  };
}): string {
  const profile = row.creatorUser.creatorProfile;
  return (
    profile?.instagramHandle ??
    profile?.displayName ??
    row.creatorUser.name ??
    row.creatorUser.email.split("@")[0] ??
    "creator"
  );
}

function resolveUpiVpa(
  stored: string | null | undefined,
  _brandDomain: string,
): string | null {
  return stored ?? null;
}

@Injectable()
export class BrandPayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brandAuth: BrandCentreAuthService,
  ) {}

  async getPayoutsHub(user: AuthUser) {
    if (user.role !== UserRole.BRAND) {
      throw new ForbiddenException("Brand access required");
    }

    const brandProfileId = await this.brandAuth.resolveBrandProfileId(user);
    const brand = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: {
        id: true,
        name: true,
        domain: true,
        payoutsWorkspaceRole: true,
      },
    });

    if (!brand) {
      throw new NotFoundException("Brand profile not found");
    }

    const vaultRow = await this.prisma.brandEscrowVault.findUnique({
      where: { brandProfileId },
    });

    const activeCollaborations = await this.prisma.collaboration.findMany({
      where: {
        brandProfileId,
        isTerminated: false,
        commercials: {
          escrowStatus: { in: ACTIVE_ESCROW_STATUSES },
        },
      },
      select: { id: true },
    });

    const stalledAllocations = await this.prisma.collaboration.count({
      where: {
        brandProfileId,
        isTerminated: false,
        commercials: { escrowStatus: CollaborationEscrowStatus.AWAITING_FUNDS },
      },
    });

    if (!vaultRow) {
      return {
        workspace_role: brand.payoutsWorkspaceRole,
        vault_missing: true,
        vault: null,
        brand_corporate_name: brand.name,
        summary: {
          active_campaign_count: activeCollaborations.length,
          stalled_allocations_count: stalledAllocations,
        },
        funding: null,
        ledger: [],
        escrow_locks: [],
        disbursals: [],
      };
    }

    const vault = mapEscrowVault(vaultRow);

    const escrowLocks = await this.prisma.collaborationEscrowLock.findMany({
      where: {
        brandProfileId,
        lockReleasedViaRefund: false,
      },
      include: {
        collaboration: { include: COLLABORATION_THREAD_INCLUDE },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const ledgerRows = await this.prisma.escrowTransactionLedger.findMany({
      where: { vaultId: vaultRow.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const canonicalPayouts = await this.prisma.escrowCreatorPayout.findMany({
      where: { brandProfileId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const collaborationIds = [
      ...new Set(
        [
          ...ledgerRows.map((row) => row.collaborationId),
          ...canonicalPayouts.map((row) => row.collaborationId),
        ].filter((id): id is string => Boolean(id)),
      ),
    ];

    const collaborations =
      collaborationIds.length > 0
        ? await this.prisma.collaboration.findMany({
            where: { id: { in: collaborationIds } },
            include: COLLABORATION_THREAD_INCLUDE,
          })
        : [];

    const collabById = new Map(collaborations.map((row) => [row.id, row]));

    const ledger = ledgerRows.map((entry) => {
      const collab = entry.collaborationId
        ? collabById.get(entry.collaborationId)
        : undefined;
      return {
        transaction_id: entry.id,
        transaction_type: entry.transactionType,
        payout_tranche_target: entry.payoutTrancheTarget,
        amount: decimalToNumber(entry.amount),
        currency: entry.currency,
        transaction_status: entry.transactionStatus,
        collaboration_id: entry.collaborationId,
        campaign_id: collab?.campaignId ?? null,
        campaign_name: collab?.campaign.name ?? null,
        creator_handle: collab ? resolveCreatorHandle(collab) : null,
        gateway_reference_id: entry.gatewayReferenceId,
        created_at: entry.createdAt.toISOString(),
      };
    });

    const escrow_locks = escrowLocks.map((lock) => ({
      lock_id: lock.id,
      collaboration_id: lock.collaborationId,
      campaign_id: lock.collaboration.campaignId,
      creator_handle: resolveCreatorHandle(lock.collaboration),
      campaign_name: lock.collaboration.campaign.name,
      gross_base_quote: decimalToNumber(lock.grossCreatorQuote),
      platform_commission: decimalToNumber(lock.platformCommissionFee),
      platform_commission_gst: decimalToNumber(lock.platformCommissionGst),
      tds_buffer_pool: decimalToNumber(lock.calculatedTdsDeduction),
      total_hold_value: decimalToNumber(lock.totalEscrowLockedAmount),
      current_stage: lock.collaboration.currentStage,
    }));

    const legacyDisbursals = ledgerRows
      .filter((entry) => DISBURSAL_TYPES.has(entry.transactionType))
      .map((entry) => {
        const collab = entry.collaborationId
          ? collabById.get(entry.collaborationId)
          : undefined;
        return {
          disbursal_id: entry.id,
          collaboration_id: entry.collaborationId,
          recipient_creator: collab ? resolveCreatorHandle(collab) : null,
          campaign_name: collab?.campaign.name ?? null,
          tranche_phase: entry.payoutTrancheTarget
            ? String(entry.payoutTrancheTarget)
            : null,
          net_settled_amount: decimalToNumber(entry.amount),
          razorpay_clearing_reference: entry.gatewayReferenceId,
          cleared_at: entry.createdAt.toISOString(),
          transaction_status: entry.transactionStatus,
        };
      });
    const disbursals = [
      ...canonicalPayouts.map((payout) => {
        const collab = collabById.get(payout.collaborationId);
        return {
          disbursal_id: payout.id,
          collaboration_id: payout.collaborationId,
          recipient_creator: collab ? resolveCreatorHandle(collab) : null,
          campaign_name: collab?.campaign.name ?? null,
          tranche_phase: payout.tranche,
          net_settled_amount: decimalToNumber(payout.contractedAmount),
          razorpay_clearing_reference: payout.currentProviderPayoutId,
          cleared_at: payout.paidAt?.toISOString() ?? null,
          transaction_status: payout.status,
        };
      }),
      ...legacyDisbursals,
    ];

    return {
      workspace_role: brand.payoutsWorkspaceRole,
      vault_missing: false,
      vault,
      brand_corporate_name: brand.name,
      summary: {
        active_campaign_count: activeCollaborations.length,
        stalled_allocations_count: stalledAllocations,
      },
      funding: {
        account_name: `Aura Escrow Account — ${brand.name}`,
        corporate_account_number: vault.virtual_account_number,
        ifsc_code: vault.ifsc_code,
        upi_vpa: resolveUpiVpa(vault.upi_vpa, brand.domain),
        bank_partner: vault.bank_name,
        razorpay_virtual_account_id: vault.razorpay_virtual_account_id,
      },
      ledger,
      escrow_locks,
      disbursals,
    };
  }
}
