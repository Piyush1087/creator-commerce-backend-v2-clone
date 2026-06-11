-- CreateTable
CREATE TABLE "brand_billing_invoices" (
    "invoice_row_id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "razorpay_invoice_id" TEXT NOT NULL,
    "razorpay_subscription_id" TEXT NOT NULL,
    "razorpay_payment_id" TEXT,
    "short_url" TEXT,
    "status" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "amount_paid" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "invoice_number" TEXT,
    "paid_at" TIMESTAMP(3),
    "billing_period_start" TIMESTAMP(3),
    "billing_period_end" TIMESTAMP(3),
    "issued_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_billing_invoices_pkey" PRIMARY KEY ("invoice_row_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brand_billing_invoices_razorpay_invoice_id_key" ON "brand_billing_invoices"("razorpay_invoice_id");

-- CreateIndex
CREATE INDEX "brand_billing_invoices_brand_id_idx" ON "brand_billing_invoices"("brand_id");

-- CreateIndex
CREATE INDEX "brand_billing_invoices_subscription_id_idx" ON "brand_billing_invoices"("subscription_id");

-- CreateIndex
CREATE INDEX "brand_billing_invoices_paid_at_idx" ON "brand_billing_invoices"("paid_at");

-- AddForeignKey
ALTER TABLE "brand_billing_invoices" ADD CONSTRAINT "brand_billing_invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "brand_subscriptions"("subscription_id") ON DELETE CASCADE ON UPDATE CASCADE;
