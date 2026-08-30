import type { BrandEscrowVault } from "@prisma/client";

export function mapEscrowVault(vault: BrandEscrowVault) {
  return {
    vault_id: vault.id,
    brand_id: vault.brandProfileId,
    razorpay_virtual_account_id: vault.razorpayVirtualAccountId,
    virtual_account_number: vault.virtualAccountNumber,
    ifsc_code: vault.ifscCode,
    upi_vpa: vault.upiVpa,
    bank_name: vault.bankName,
    virtual_account_enabled: vault.virtualAccountEnabled,
    currency: vault.currency,
    total_pooled_balance: vault.totalPooledBalance.toNumber(),
    locked_campaign_funds: vault.lockedCampaignFunds.toNumber(),
    available_balance: vault.availableBalance.toNumber(),
    active_return_commitment: vault.activeReturnCommitment.toNumber(),
    tds_buffer_balance: vault.tdsBufferBalance.toNumber(),
    created_at: vault.createdAt.toISOString(),
    updated_at: vault.updatedAt.toISOString(),
  };
}
