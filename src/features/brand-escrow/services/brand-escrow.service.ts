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

  async ensureVault(brandProfileId: string, provisionVirtualAccount = false) {
    const brand = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
    });
    if (!brand) throw new NotFoundException("Brand profile not found");
    const currency = resolveEscrowCurrency(brand);
    let vault = await this.prisma.brandEscrowVault.upsert({
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
      const account = await this.razorpay.createVirtualAccount({
        description: `Treasury funding account for ${brand.name}`,
      });
      const bank = extractBankReceiver(account.receivers);
      vault = await this.prisma.brandEscrowVault.update({
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
    const existing = await this.prisma.escrowFundingLoad.findUnique({
      where: { idempotencyKey },
    });
    if (existing) return this.mapCheckout(existing);
    const fee =
      vault.currency === "INR" ? principal.mul("0.02") : new Decimal(0);
    const feeTax = vault.currency === "INR" ? fee.mul("0.18") : new Decimal(0);
    const load = await this.prisma.escrowFundingLoad.create({
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
    const order = await this.razorpay.createOrder({
      amountPaise: Math.round(principal.add(fee).add(feeTax).toNumber() * 100),
      currency: vault.currency,
      receipt: load.id,
      notes: {
        vault_id: vault.id,
        idempotency_key: idempotencyKey,
        funding_load_id: load.id,
      },
    });
    return this.mapCheckout(
      await this.prisma.escrowFundingLoad.update({
        where: { id: load.id },
        data: { providerOrderId: order.id, state: "PENDING" },
      }),
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
