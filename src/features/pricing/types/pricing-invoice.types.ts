export type BillingInvoiceView = {
  id: string;
  razorpayInvoiceId: string;
  razorpayPaymentId: string | null;
  status: string;
  amount: number;
  amountPaid: number;
  currency: string;
  invoiceNumber: string | null;
  shortUrl: string | null;
  paidAt: string | null;
  issuedAt: string | null;
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
  lineItems: Array<{
    name: string;
    amount: number;
    currency: string;
  }>;
};
