import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "../../../prisma/prisma.service";
import { mapEscrowVault } from "../utils/map-escrow-vault.util";
import { resolveEscrowCurrency } from "../utils/resolve-escrow-currency.util";
import { EscrowComputationEngine } from "./escrow-computation.engine";
import { EscrowSubscriptionContextService } from "./escrow-subscription-context.service";
import { extractBankReceiver, extractVpaReceiver, RazorpayClient } from "./razorpay.client";

@Injectable()
export class BrandEscrowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpay: RazorpayClient,
    private readonly computationEngine: EscrowComputationEngine,
    private readonly escrowBilling: EscrowSubscriptionContextService,
  ) {}

  async initializeSecureVault(brandProfileId: string) {
    const brand = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
    });

    if (!brand) {
      throw new NotFoundException("Brand profile not found");
    }

    const existingVault = await this.prisma.brandEscrowVault.findUnique({
      where: { brandProfileId },
    });

    if (existingVault) {
      throw new ConflictException(
        "A secure escrow vault is already bound to this brand workspace",
      );
    }

    const currency = resolveEscrowCurrency(brand);
    const rzpData = await this.razorpay.createVirtualAccount({
      description: `Escrow vault for ${brand.name}`,
    });
    const bankAccount = extractBankReceiver(rzpData.receivers);
    const upiVpa =
      extractVpaReceiver(rzpData.receivers) ??
      `${brand.domain.replace(/[^a-z0-9]/gi, "").toLowerCase()}.escrow@razorpay`;

    const vault = await this.prisma.brandEscrowVault.create({
      data: {
        brandProfileId,
        razorpayVirtualAccountId: rzpData.id,
        virtualAccountNumber: bankAccount.account_number!,
        ifscCode: bankAccount.ifsc!,
        upiVpa,
        bankName:
          bankAccount.bank_name ?? "RBL Bank (Razorpay Escrow Partner Node)",
        currency,
        totalPooledBalance: new Decimal(0),
        lockedCampaignFunds: new Decimal(0),
        availableBalance: new Decimal(0),
        tdsBufferBalance: new Decimal(0),
      },
    });

    return mapEscrowVault(vault);
  }

  async getVault(brandProfileId: string) {
    const vault = await this.prisma.brandEscrowVault.findUnique({
      where: { brandProfileId },
    });

    if (!vault) {
      throw new NotFoundException("Escrow vault not initialized for this brand");
    }

    return mapEscrowVault(vault);
  }

  async listLedger(brandProfileId: string, limit = 50) {
    const vault = await this.prisma.brandEscrowVault.findUnique({
      where: { brandProfileId },
      select: { id: true },
    });

    if (!vault) {
      throw new NotFoundException("Escrow vault not initialized for this brand");
    }

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
    const vault = await this.prisma.brandEscrowVault.findUnique({
      where: { brandProfileId },
    });

    if (!vault) {
      throw new NotFoundException(
        "Escrow vault must be initialized before funding",
      );
    }

    const allocationAmount = new Decimal(targetAllocation);
    let gatewayProcessingSurcharge = new Decimal(0);
    let gatewaySurchargeGst = new Decimal(0);

    if (vault.currency === "INR") {
      gatewayProcessingSurcharge = allocationAmount.mul(0.02);
      gatewaySurchargeGst = gatewayProcessingSurcharge.mul(0.18);
    } else {
      gatewayProcessingSurcharge = allocationAmount.mul(0.02);
    }

    const totalInvoiceChargeAmount = allocationAmount
      .add(gatewayProcessingSurcharge)
      .add(gatewaySurchargeGst);

    const transactionRecord = await this.prisma.escrowTransactionLedger.create({
      data: {
        vaultId: vault.id,
        brandProfileId,
        transactionType: "GATEWAY_TOPUP_CARD",
        amount: allocationAmount,
        currency: vault.currency,
        gatewayProcessingSurcharge,
        gatewaySurchargeGst,
        idempotencyKey,
        transactionStatus: "PROCESSING_GATEWAY",
      },
    });

    const order = await this.razorpay.createOrder({
      amountPaise: Math.round(totalInvoiceChargeAmount.toNumber() * 100),
      currency: vault.currency,
      receipt: transactionRecord.id,
      notes: {
        vault_id: vault.id,
        idempotency_key: idempotencyKey,
        internal_transaction_id: transactionRecord.id,
      },
    });

    await this.prisma.escrowTransactionLedger.update({
      where: { id: transactionRecord.id },
      data: { gatewayReferenceId: order.id },
    });

    return {
      checkout_order_id: order.id,
      internal_transaction_id: transactionRecord.id,
      total_invoice_charge_amount: totalInvoiceChargeAmount.toNumber(),
      allocation_amount: allocationAmount.toNumber(),
      gateway_surcharge: gatewayProcessingSurcharge.toNumber(),
      surcharge_gst: gatewaySurchargeGst.toNumber(),
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
