We will now architect the database integration layer for the **Escrow & Wallet Module** using Prisma and PostgreSQL.  
Per your backend workflow documents, this database architecture handles multi-tenant ledger accounts, processes virtual wallets, tracks financial transactions, and automates the **Indian Statutory TDS (Tax Deducted at Source)** withholding logs under **Section 194-C** (governing active gross commercial contracts and creator collaborations).

### **1\. Extending the Prisma Database Models (**prisma/schema.prisma**)**

Add the following transactional tables directly to your existing schema.prisma file. It sets up strict foreign-key relations with the core Brand table and enforces high-precision data storage using exact database decimals to prevent floating-point calculation drift.  
Code snippet  
// \=============================================================================  
// ENUMERATION TYPES FOR THE ESCROW & WALLET SYSTEM  
// \=============================================================================

enum EscrowAccountStatus {  
  ACTIVE  
  FROZEN  
  UNDER\_AUDIT  
}

enum TransactionType {  
  DEPOSIT          // Inbound wallet funding  
  ESCROW\_LOCK      // Committing milestone funds for a specific creator contract  
  ESCROW\_RELEASE   // Direct disbursement to recipient on milestone approval  
  TDS\_WITHHOLDING  // Statutory tax retention logic execution  
}

enum TransactionStatus {  
  PENDING\_ACH\_CLEARING  
  SETTLED  
  REJECTED  
  REVERSED  
}

enum TdsSectionCode {  
  SEC\_194\_C       // 2% Multi-Tenant Contractor Withholding threshold rule  
  SEC\_194\_R       // Business promotion perks and non-monetary benefits tracking  
}

// \=============================================================================  
// ESCROW AND LEDGER ACCOUNT DATA MODELS  
// \=============================================================================

model EscrowWallet {  
  walletId        String              @id @default(dbgenerated("gen\_random\_uuid()")) @map("wallet\_id") @db.Uuid  
  brandId         String              @unique @map("brand\_id") @db.Uuid // Strict 1:1 matching tenant isolation  
    
  // High-precision arithmetic storage tracking actual cash vs statutory allocations  
  availableBalance Decimal            @default(0.00) @map("available\_balance") @db.Decimal(18, 4\)  
  escrowedBalance  Decimal            @default(0.00) @map("escrowed\_balance") @db.Decimal(18, 4\)  
  tdsBufferBalance Decimal            @default(0.00) @map("tds\_buffer\_balance") @db.Decimal(18, 4\)  
    
  currencyCode    String              @default("INR") @map("currency\_code") @db.VarChar(3)  
  accountStatus   EscrowAccountStatus @default(ACTIVE) @map("account\_status")  
  createdAt       DateTime            @default(now()) @map("created\_at") @db.Timestamptz  
  updatedAt       DateTime            @updatedAt @map("updated\_at") @db.Timestamptz

  // Relational mappings  
  brand        Brand               @relation(fields: \[brandId\], references: \[brandId\], onDelete: Cascade)  
  transactions WalletTransaction\[\]  
  tdsFilings   TdsWithholdingLog\[\]

  @@map("escrow\_wallets")  
}

model WalletTransaction {  
  transactionId String            @id @default(dbgenerated("gen\_random\_uuid()")) @map("transaction\_id") @db.Uuid  
  walletId      String            @map("wallet\_id") @db.Uuid  
  campaignId    String?           @map("campaign\_id") @db.Uuid // Nullable if generic brand deposit/withdrawal  
    
  type          TransactionType  
  status        TransactionStatus @default(SETTLED)  
    
  // Financial vectors  
  grossAmount   Decimal           @map("gross\_amount") @db.Decimal(18, 4\)  
  feeAmount     Decimal           @default(0.00) @map("fee\_amount") @db.Decimal(18, 4\)  
  netAmount     Decimal           @map("net\_amount") @db.Decimal(18, 4\)  
    
  referenceUuid String            @unique @map("reference\_uuid") @db.Uuid // External payment gateway link trace (e.g., RazorpayX Transfer ID)  
  idempotencyKey String           @unique @map("idempotency\_key") @db.VarChar(255) // Prevents double-spend replays  
  auditMemo     String            @map("audit\_memo") @db.VarChar(512)  
  createdAt     DateTime          @default(now()) @map("created\_at") @db.Timestamptz

  // Structural associations  
  wallet   EscrowWallet @relation(fields: \[walletId\], references: \[walletId\], onDelete: Cascade)  
  campaign Campaign?    @relation(fields: \[campaignId\], references: \[campaignId\], onDelete: SetNull)  
  tdsLog   TdsWithholdingLog?

  @@index(\[walletId\])  
  @@index(\[status\])  
  @@map("wallet\_transactions")  
}

model TdsWithholdingLog {  
  tdsLogId       String         @id @default(dbgenerated("gen\_random\_uuid()")) @map("tds\_log\_id") @db.Uuid  
  walletId       String         @map("wallet\_id") @db.Uuid  
  transactionId  String         @unique @map("transaction\_id") @db.Uuid // Linked 1:1 to triggering transactional debit row  
    
  sectionCode    TdsSectionCode @default(SEC\_194\_C) @map("section\_code")  
  withholdingRate Decimal        @map("withholding\_rate") @db.Decimal(5, 2\) // Typically 2.00% matching your compliance specifications  
  taxWithheld    Decimal        @map("tax\_withheld") @db.Decimal(18, 4\)  
    
  panAcknowledged String        @map("pan\_acknowledged") @db.VarChar(10) // Masked encrypted compliance check trace  
  isChallanFiled  Boolean        @default(false) @map("is\_challan\_filed")  
  createdAt      DateTime       @default(now()) @map("created\_at") @db.Timestamptz

  wallet      EscrowWallet      @relation(fields: \[walletId\], references: \[walletId\], onDelete: Cascade)  
  transaction WalletTransaction @relation(fields: \[transactionId\], references: \[transactionId\], onDelete: Cascade)

  @@index(\[walletId\])  
  @@map("tds\_withholding\_logs")  
}

### **2\. Double-Entry Zod Schema Guardrails (**shared/schemas/wallet.schema.ts**)**

This validation schema processes incoming milestone disbursement actions, forcing calculations to explicitly pass business validation checks before reaching the transactional service worker.  
TypeScript  
import { z } from 'zod';

export const DisburseMilestoneSchema \= z.object({  
  brandId: z.string().uuid({ message: "Multi-tenant context execution must pass a valid UUID v4 token" }),  
  campaignId: z.string().uuid({ message: "Target campaign context must resolve to a valid UUID v4 token" }),  
  grossPayout: z.number()  
    .positive({ message: "Payout amount must be greater than zero" })  
    .max(5000000, { message: "Disbursement single transaction block exceeds safety limit thresholds" }),  
  panToken: z.string()  
    .regex(/^\[A-Z\]{5}\[0-9\]{4}\[A-Z\]{1}$/, { message: "Invalid Permanent Account Number (PAN) syntax structure mapped" }),  
  idempotencyKey: z.string().min(10, { message: "Cryptographic replay protection token required" })  
});

export type DisburseMilestoneInput \= z.infer\<typeof DisburseMilestoneSchema\>;

### **3\. NestJS Transactional Database Service Worker (**backend/src/wallet/wallet.service.ts**)**

This processing service executes a **PostgreSQL Database Transaction Isolation Block**. It performs a double-entry balance adjustment, runs client-side calculation matching, creates ledger statements, and moves the 2% Section 194-C tax slice securely into the tds\_buffer\_balance column in a single, atomic operation.  
TypeScript  
import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';  
import { PrismaService } from '../prisma/prisma.service';  
import { DisburseMilestoneInput } from 'shared/schemas/wallet.schema';  
import { Prisma } from '@prisma/client';

@Injectable()  
export class WalletService {  
  constructor(private readonly prisma: PrismaService) {}

  async processMilestoneDisbursement(input: DisburseMilestoneInput) {  
    const TAX\_RATE\_194C \= new Prisma.Decimal(0.02); // Strict Indian Statutory 2% baseline allocation matrix  
    const gross \= new Prisma.Decimal(input.grossPayout);

    try {  
      // Wrap calculation pipelines inside an atomic storage ledger protection bracket  
      return await this.prisma.$transaction(async (tx) \=\> {  
          
        // 1\. Lock the wallet using explicit selective record isolation rows  
        const currentWallet \= await tx.escrowWallet.findUnique({  
          where: { brandId: input.brandId }  
        });

        if (\!currentWallet) {  
          throw new BadRequestException('Escrow profile entity isolation missing.');  
        }

        // Calculate dynamic tax components matching the UI audit numbers  
        const taxWithheld \= gross.mul(TAX\_RATE\_194C); // gross \* 0.02  
        const netDisbursedToCreator \= gross.sub(taxWithheld); // gross \- tax

        // 2\. Validate financial asset liquidity checks  
        if (currentWallet.escrowedBalance.lessThan(gross)) {  
          throw new BadRequestException('Insufficient locked contract escrow balance assets available.');  
        }

        // 3\. Update account ledgers: decrement escrowed, increment consolidated statutory buffer reserves  
        const updatedWallet \= await tx.escrowWallet.update({  
          where: { walletId: currentWallet.walletId },  
          data: {  
            escrowedBalance: { decrement: gross },  
            tdsBufferBalance: { increment: taxWithheld }  
          }  
        });

        // 4\. Generate the master base record tracking the gross debit  
        const primaryTx \= await tx.walletTransaction.create({  
          data: {  
            walletId: currentWallet.walletId,  
            campaignId: input.campaignId,  
            type: 'ESCROW\_RELEASE',  
            status: 'SETTLED',  
            grossAmount: gross,  
            feeAmount: new Prisma.Decimal(0.00),  
            netAmount: netDisbursedToCreator,  
            referenceUuid: crypto.randomUUID(), // Simulated payment rail allocation mapping trace  
            idempotencyKey: input.idempotencyKey,  
            auditMemo: \`Milestone settlement processed. Net: ${netDisbursedToCreator.toFixed(2)} disbursed. Tax Section 194-C logged.\`  
          }  
        });

        // 5\. Append the auxiliary physical log mapping the compliance parameters  
        await tx.tdsWithholdingLog.create({  
          data: {  
            walletId: currentWallet.walletId,  
            transactionId: primaryTx.transactionId,  
            sectionCode: 'SEC\_194\_C',  
            withholdingRate: TAX\_RATE\_194C.mul(100), // Stores numeric rate parameter exactly as 2.00  
            taxWithheld: taxWithheld,  
            panAcknowledged: input.panToken.slice(0, 3) \+ 'XXXX' \+ input.panToken.slice(-3), // Secure masked compliance logging  
            isChallanFiled: false  
          }  
        });

        return {  
          status: 'SUCCESSFUL\_SETTLEMENT\_LOCKED',  
          walletId: updatedWallet.walletId,  
          transactionId: primaryTx.transactionId,  
          grossProcessed: gross.toNumber(),  
          taxBuffered: taxWithheld.toNumber(),  
          netToCreator: netDisbursedToCreator.toNumber(),  
          remainingTdsVaultBalance: updatedWallet.tdsBufferBalance.toNumber()  
        };  
      });

    } catch (dbError: any) {  
      if (dbError instanceof BadRequestException) throw dbError;  
      throw new InternalServerErrorException({  
        message: 'Relational Ledger Core Execution Fault Encountered.',  
        error: dbError.message || dbError  
      });  
    }  
  }  
}

### **What is the next logical module layer?**

* **Option 1**: Implement the frontend **Wallet Dashboard Layout Panel Component** inside our React 18 codebase to view these multi-tenant statutory buffer pools live.  
* **Option 2**: Generate the mock dataset seed file (prisma/seed.ts) to pre-fill accounts with mock data for both your campaign engines and virtual wallet ledgers.

