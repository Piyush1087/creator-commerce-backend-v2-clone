import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "../../../prisma/prisma.service";
import { SubscriptionCapabilityService } from "../../pricing/services/subscription-capability.service";
import { mapEscrowVault } from "../utils/map-escrow-vault.util";
import { resolveEscrowCurrency } from "../utils/resolve-escrow-currency.util";
import { EscrowComputationEngine } from "./escrow-computation.engine";
import { EscrowSubscriptionContextService } from "./escrow-subscription-context.service";
import {
  extractBankReceiver,
  extractVpaReceiver,
  RazorpayClient,
} from "./razorpay.client";

@Injectable()
export class BrandEscrowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpay: RazorpayClient,
    private readonly computationEngine: EscrowComputationEngine,
    private readonly escrowBilling: EscrowSubscriptionContextService,
    private readonly subscriptionCapabilities: SubscriptionCapabilityService,
    private readonly config: ConfigService,
  ) {}

  private virtualAccountsEnabled(): boolean {
    return (
      this.config
        .get<string>("RAZORPAY_VIRTUAL_ACCOUNTS_ENABLED", "false")
        .toLowerCase() === "true"
    );
  }

  async ensureVault(brandProfileId: string, provisionVirtualAccount = true) {
    const brand = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
    });
    if (!brand) throw new NotFoundException("Brand profile not found");
    const currency = resolveEscrowCurrency(brand);
    const vault = await this.prisma.brandEscrowVault.upsert({
      where: { brandProfileId },
      create: { brandProfileId, currency },
      update: {},
    });
    if (
      provisionVirtualAccount &&
      currency === "INR" &&
      this.virtualAccountsEnabled() &&
      !vault.razorpayVirtualAccountId
    ) {
      return this.prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`escrow-va:${brandProfileId}`}))`;
          const authoritative = await tx.brandEscrowVault.findUniqueOrThrow({
            where: { id: vault.id },
          });
          if (authoritative.razorpayVirtualAccountId) return authoritative;
          const account = await this.razorpay.createVirtualAccount({
            description: `Treasury funding account for ${brand.name}`,
          });
          const bank = extractBankReceiver(account.receivers);
          return tx.brandEscrowVault.update({
            where: { id: vault.id },
            data: {
              razorpayVirtualAccountId: account.id,
              virtualAccountNumber: bank?.account_number ?? null,
              ifscCode: bank?.ifsc ?? null,
              upiVpa: extractVpaReceiver(account.receivers),
              bankName: bank?.bank_name ?? null,
              virtualAccountEnabled: true,
            },
          });
        },
        { maxWait: 10_000, timeout: 30_000 },
      );
    }
    return vault;
  }

  /** Deprecated compatibility adapter; all normal reads/funding provision lazily. */
  async initializeSecureVault(brandProfileId: string) {
    return mapEscrowVault(await this.ensureVault(brandProfileId, true));
  }

  async getVault(brandProfileId: string) {
    const vault = await this.ensureVault(brandProfileId);
    const pending = await this.prisma.escrowFundingLoad.aggregate({
      where: {
        vaultId: vault.id,
        state: { in: ["LOAD_INITIATED", "PENDING"] },
      },
      _sum: { principalAmount: true },
    });
    return {
      ...mapEscrowVault(vault),
      pending_funding: pending._sum.principalAmount?.toNumber() ?? 0,
    };
  }

  async listLedger(brandProfileId: string, limit = 50) {
    const vault = await this.ensureVault(brandProfileId);
    const entries = await this.prisma.escrowTransactionLedger.findMany({
      where: { vaultId: vault.id },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 100),
    });
    return entries.map((entry) => ({
      transaction_id: entry.id,
      transaction_type: entry.transactionType,
      payout_tranche_target: entry.payoutTrancheTarget,
      amount: entry.amount.toNumber(),
      currency: entry.currency,
      gateway_processing_surcharge: entry.gatewayProcessingSurcharge.toNumber(),
      gateway_surcharge_gst: entry.gatewaySurchargeGst.toNumber(),
      transaction_status: entry.transactionStatus,
      collaboration_id: entry.collaborationId,
      gateway_reference_id: entry.gatewayReferenceId,
      created_at: entry.createdAt.toISOString(),
    }));
  }

  async createCardTopUpIntent(
    brandProfileId: string,
    targetAllocation: number,
    idempotencyKey: string,
  ) {
    await this.subscriptionCapabilities.assertCapability(
      brandProfileId,
      "ESCROW_TOP_UP",
    );
    const vault = await this.ensureVault(brandProfileId);
    const principal = new Decimal(targetAllocation);
    if (vault.currency === "INR" && principal.lessThan(5000))
      throw new BadRequestException("Minimum INR treasury top-up is 5000");
    let existing = await this.prisma.escrowFundingLoad.findUnique({
      where: { idempotencyKey },
    });
    if (existing) return this.ensureProviderOrder(existing.id);
    const fee =
      vault.currency === "INR" ? principal.mul("0.02") : new Decimal(0);
    const feeTax = vault.currency === "INR" ? fee.mul("0.18") : new Decimal(0);
    let load;
    try {
      load = await this.prisma.escrowFundingLoad.create({
        data: {
          vaultId: vault.id,
          brandProfileId,
          sourceType: "GATEWAY",
          currency: vault.currency,
          principalAmount: principal,
          processingFee: fee,
          processingFeeTax: feeTax,
          state: "LOAD_INITIATED",
          idempotencyKey,
          initiatedAt: new Date(),
        },
      });
    } catch (error) {
      if (!this.isUniqueConstraint(error)) throw error;
      existing = await this.prisma.escrowFundingLoad.findUnique({
        where: { idempotencyKey },
      });
      if (!existing) throw error;
      return this.ensureProviderOrder(existing.id);
    }
    await this.prisma.escrowTransactionLedger.create({
      data: {
        vaultId: vault.id,
        brandProfileId,
        transactionType: "LOAD",
        amount: principal,
        currency: vault.currency,
        idempotencyKey: `load:${idempotencyKey}`,
        transactionStatus: "PENDING",
      },
    });
    if (fee.greaterThan(0))
      await this.prisma.escrowTransactionLedger.create({
        data: {
          vaultId: vault.id,
          brandProfileId,
          transactionType: "LOAD_FEE",
          amount: fee.add(feeTax),
          currency: vault.currency,
          gatewayProcessingSurcharge: fee,
          gatewaySurchargeGst: feeTax,
          idempotencyKey: `load-fee:${idempotencyKey}`,
          transactionStatus: "PENDING",
        },
      });
    return this.ensureProviderOrder(load.id);
  }

  private async ensureProviderOrder(loadId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`escrow-order:${loadId}`}))`;
        const load = await tx.escrowFundingLoad.findUniqueOrThrow({
          where: { id: loadId },
        });
        if (load.providerOrderId) return this.mapCheckout(load);
        const expectedAmount = Math.round(
          load.principalAmount
            .add(load.processingFee)
            .add(load.processingFeeTax)
            .toNumber() * 100,
        );
        let order = await this.razorpay.findOrderByReceipt(load.id);
        if (!order) {
          try {
            order = await this.razorpay.createOrder({
              amountPaise: expectedAmount,
              currency: load.currency,
              receipt: load.id,
              notes: {
                vault_id: load.vaultId,
                idempotency_key: load.idempotencyKey ?? "",
                funding_load_id: load.id,
              },
            });
          } catch (error) {
            order = await this.razorpay.findOrderByReceipt(load.id);
            if (!order) throw error;
          }
        }
        if (
          order.receipt !== load.id ||
          order.currency?.toUpperCase() !== load.currency.toUpperCase() ||
          order.amount !== expectedAmount
        ) {
          throw new BadRequestException(
            "Recovered provider order does not match the funding load",
          );
        }
        return this.mapCheckout(
          await tx.escrowFundingLoad.update({
            where: { id: load.id },
            data: { providerOrderId: order.id, state: "PENDING" },
          }),
        );
      },
      { maxWait: 10_000, timeout: 30_000 },
    );
  }

  private isUniqueConstraint(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    );
  }

  private mapCheckout(load: {
    id: string;
    providerOrderId: string | null;
    principalAmount: Decimal;
    processingFee: Decimal;
    processingFeeTax: Decimal;
  }) {
    return {
      checkout_order_id: load.providerOrderId,
      funding_load_id: load.id,
      total_invoice_charge_amount: load.principalAmount
        .add(load.processingFee)
        .add(load.processingFeeTax)
        .toNumber(),
      allocation_amount: load.principalAmount.toNumber(),
      gateway_surcharge: load.processingFee.toNumber(),
      surcharge_gst: load.processingFeeTax.toNumber(),
    };
  }

  async calculateBreakdown(
    brandProfileId: string,
    input: {
      grossCreatorQuote: number;
      currency: "INR" | "USD";
      expectedTdsPercentage: 0 | 1 | 2;
    },
  ) {
    const platformTakeRate =
      await this.escrowBilling.resolveTakeRateForBrand(brandProfileId);
    const metrics = this.computationEngine.calculateStructure({
      ...input,
      platformTakeRate,
    });
    return {
      gross_creator_quote: metrics.grossCreatorQuote.toNumber(),
      platform_commission_fee: metrics.platformCommissionFee.toNumber(),
      platform_commission_gst: metrics.platformCommissionGst.toNumber(),
      platform_take_rate: platformTakeRate,
      total_escrow_locked_amount: metrics.totalEscrowLockedAmount.toNumber(),
      calculated_tds_deduction: metrics.calculatedTdsDeduction.toNumber(),
      net_creator_payout_pool: metrics.netCreatorPayoutPool.toNumber(),
    };
  }
}
