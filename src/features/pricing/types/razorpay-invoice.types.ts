export interface RazorpayInvoiceEntity {
  id: string;
  entity?: string;
  invoice_number?: string | null;
  subscription_id?: string | null;
  payment_id?: string | null;
  status?: string;
  amount?: number;
  amount_paid?: number;
  currency?: string;
  short_url?: string | null;
  paid_at?: number | null;
  issued_at?: number | null;
  billing_start?: number | null;
  billing_end?: number | null;
  line_items?: Array<{
    name?: string;
    amount?: number;
    currency?: string;
  }>;
}

export interface RazorpayInvoiceCollection {
  entity: string;
  count: number;
  items: RazorpayInvoiceEntity[];
}
