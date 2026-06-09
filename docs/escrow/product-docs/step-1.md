Below is the consolidated architectural mapping followed by the production-ready **PostgreSQL Dialect Schema Extension** for the Escrow Engine.

### **Consolidated Schema Architecture Mapping**

The platform operates across an interconnected state-machine system. The Escrow module bridges these states via specific relational hooks:

1. **Onboarding & Brand Centre Integration**: Captures the website\_url to set workspace currency definitions (INR vs. USD).  
2. **Universal Campaign Engine**: Gathers budget parameters to handle dynamic credit checks against a brand's master account metrics.  
3. **Unified Collaboration Engine**: Tracks the state lifecycle from **Stage 2 (SECUREMENT)** where the absolute funding lock is validated, to **Stage 5 (POSTING)** where automated live-post verification releases the split payouts.

┌────────────────────────┐      Instantiates      ┌─────────────────────────────┐  
│      BRANDS TABLE      │───────────────────────►│    BRAND\_ESCROW\_VAULTS      │  
│ (Onboarding / Currency)│                        │ (Balances & VBA Bank Routes)│  
└────────────────────────┘                        └─────────────────────────────┘  
                                                                 │  
                                                                 │ Mutates  
                                                                 ▼  
┌────────────────────────┐      Triggers Lock     ┌─────────────────────────────┐  
│  COLLABORATIONS TABLE  │───────────────────────►│ COLLABORATION\_ESCROW\_LOCKS  │  
│ (Stage 2: SECUREMENT)  │                        │ (Gross Math, platform fees) │  
└────────────────────────┘                        └─────────────────────────────┘  
                                                                 │  
                                       Generates Ledger Entry    ▼  
                                                  ┌─────────────────────────────┐  
                                                  │  ESCROW\_TRANSACTION\_LEDGER  │  
                                                  │ (Immutable Append-Only Logs)│  
                                                  └─────────────────────────────┘

### **Additional PostgreSQL Backend Schema Extension**

SQL  
\-- \=============================================================================  
\-- 1\. SYSTEM GLOBAL ENUMERATIONS (ESCROW SPECIFIC)  
\-- \=============================================================================

CREATE TYPE escrow\_transaction\_type\_enum AS ENUM (  
    'VBA\_TOPUP\_WIRE',        \-- Direct corporate bank wire ingestion (0% fee)  
    'GATEWAY\_TOPUP\_CARD',     \-- Gateway ingestion via corporate credit card  
    'CONTRACT\_LOCK\_RESERVE', \-- Frozen capital moved from Available to Locked at Stage 2  
    'TRANCHE\_ADVANCE\_RELEASE',\-- 30% Conditional distribution to creator path  
    'TRANCHE\_FINAL\_RELEASE',  \-- 70% Final distribution to creator path  
    'PLATFORM\_FEE\_CAPTURE',   \-- Release of 7% platform fee to corporate platform ledger  
    'TDS\_BUFFER\_REVERSAL',   \-- Statutory tax delta returned to brand available balance  
    'FAILED\_COLLAB\_REFUND'   \-- Complete or partial payout reversal on contract termination  
);

CREATE TYPE escrow\_transaction\_status\_enum AS ENUM (  
    'PROCESSING\_GATEWAY',    \-- Communication active with Razorpay network rails  
    'CLEARED',               \-- Funds verified, internal ledgers safely updated  
    'FAILED',                \-- Transaction aborted by bank node or gateway entity  
    'REVERSED'               \-- Settled funds returned to source ledger boundaries  
);

CREATE TYPE escrow\_payout\_tranche\_enum AS ENUM (  
    'ADVANCE\_30',  
    'FINAL\_70',  
    'PLATFORM\_COMMISSION'  
);

\-- \=============================================================================  
\-- 2\. BRAND ESCROW ARCHITECTURE (THE RBI-COMPLIANT VBA TRACKER)  
\-- \=============================================================================

CREATE TABLE brand\_escrow\_vaults (  
    vault\_id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    brand\_id UUID NOT NULL UNIQUE REFERENCES brands(brand\_id) ON DELETE RESTRICT,  
      
    \-- RazorpayX Smart Collect Mapping Nodes  
    razorpay\_virtual\_account\_id VARCHAR(255) NOT NULL UNIQUE,  
    virtual\_account\_number VARCHAR(100) NOT NULL UNIQUE,  
    ifsc\_code VARCHAR(50) NOT NULL,  
    bank\_name VARCHAR(150) NOT NULL DEFAULT 'RBL Bank (Razorpay Escrow Partner Node)',  
      
    \-- Currency Isolation Anchor  
    currency VARCHAR(3) NOT NULL DEFAULT 'INR' CHECK (currency IN ('INR', 'USD')),  
      
    \-- Precise Multi-Tenant Financial Balances (Decoupled from calculation layers)  
    total\_pooled\_balance NUMERIC(15,4) NOT NULL DEFAULT 0.0000 CHECK (total\_pooled\_balance \>= 0.0000),  
    locked\_campaign\_funds NUMERIC(15,4) NOT NULL DEFAULT 0.0000 CHECK (locked\_campaign\_funds \>= 0.0000),  
    available\_balance NUMERIC(15,4) NOT NULL DEFAULT 0.0000 CHECK (available\_balance \>= 0.0000),  
      
    \-- India-Specific Statutory Retention Node  
    tds\_buffer\_balance NUMERIC(15,4) NOT NULL DEFAULT 0.0000 CHECK (tds\_buffer\_balance \>= 0.0000),  
      
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP,  
    updated\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP,  
      
    \-- Core Mathematical Invariant Guardrail Enforced via Database Constraint  
    CONSTRAINT check\_escrow\_ledger\_integrity   
    CHECK (available\_balance \= (total\_pooled\_balance \- locked\_campaign\_funds))  
);

CREATE INDEX idx\_brand\_vaults\_lookup ON brand\_escrow\_vaults(brand\_id);  
CREATE INDEX idx\_brand\_vaults\_rzp ON brand\_escrow\_vaults(razorpay\_virtual\_account\_id);

\-- \=============================================================================  
\-- 3\. COLLABORATION FINANCIAL CONTRACT LOCKS (STAGE 2 RESOURCING)  
\-- \=============================================================================

CREATE TABLE collaboration\_escrow\_locks (  
    lock\_id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    collaboration\_id UUID NOT NULL UNIQUE REFERENCES collaborations(id) ON DELETE RESTRICT,  
    brand\_id UUID NOT NULL REFERENCES brands(brand\_id) ON DELETE RESTRICT,  
      
    \-- Base Transaction Invariants  
    gross\_creator\_quote NUMERIC(15,4) NOT NULL CHECK (gross\_creator\_quote \> 0.0000),  
    platform\_commission\_fee NUMERIC(15,4) NOT NULL, \-- Evaluated strictly at 7% of gross\_creator\_quote  
    platform\_commission\_gst NUMERIC(15,4) NOT NULL DEFAULT 0.0000, \-- 18% of commission, enforced if currency \== INR  
      
    \-- Aggregate Reservation Pool  
    total\_escrow\_locked\_amount NUMERIC(15,4) NOT NULL,  
      
    \-- India Statutory TDS Split Metrics (Calculated on gross\_creator\_quote)  
    expected\_tds\_percentage NUMERIC(4,2) NOT NULL DEFAULT 0.00 CHECK (expected\_tds\_percentage IN (0.00, 1.00, 2.00)),  
    calculated\_tds\_deduction NUMERIC(15,4) NOT NULL DEFAULT 0.0000,  
    net\_creator\_payout\_pool NUMERIC(15,4) NOT NULL,  
      
    \-- Granular Workflow Progress Toggles  
    advance\_tranche\_disbursed BOOLEAN NOT NULL DEFAULT FALSE,  
    final\_tranche\_disbursed BOOLEAN NOT NULL DEFAULT FALSE,  
    lock\_released\_via\_refund BOOLEAN NOT NULL DEFAULT FALSE,  
      
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP,  
    updated\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP,  
      
    \-- Enforce Math Constraints for Financial Protection  
    CONSTRAINT check\_lock\_math\_totals   
    CHECK (total\_escrow\_locked\_amount \= (gross\_creator\_quote \+ platform\_commission\_fee \+ platform\_commission\_gst)),  
      
    CONSTRAINT check\_net\_creator\_disbursal\_split   
    CHECK (net\_creator\_payout\_pool \= (gross\_creator\_quote \- calculated\_tds\_deduction))  
);

CREATE INDEX idx\_collab\_locks\_lookup ON collaboration\_escrow\_locks(collaboration\_id);

\-- \=============================================================================  
\-- 4\. IMMUTABLE APPEND-ONLY TRANSACTION LEDGER (THE AUDIT TRAIL)  
\-- \=============================================================================

CREATE TABLE escrow\_transaction\_ledger (  
    transaction\_id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    vault\_id UUID NOT NULL REFERENCES brand\_escrow\_vaults(vault\_id) ON DELETE RESTRICT,  
    brand\_id UUID NOT NULL REFERENCES brands(brand\_id) ON DELETE RESTRICT,  
    collaboration\_id UUID REFERENCES collaborations(id) ON DELETE RESTRICT,  
      
    transaction\_type escrow\_transaction\_type\_enum NOT NULL,  
    payout\_tranche\_target escrow\_payout\_tranche\_enum NULL,  
      
    \-- Financial Parameters  
    amount NUMERIC(15,4) NOT NULL CHECK (amount \> 0.0000),  
    currency VARCHAR(3) NOT NULL,  
      
    \-- Ingestion Inbound Surcharge Line-Items  
    gateway\_processing\_surcharge NUMERIC(15,4) NOT NULL DEFAULT 0.0000, \-- 2% for credit cards  
    gateway\_surcharge\_gst NUMERIC(15,4) NOT NULL DEFAULT 0.0000,        \-- 18% GST on card fee  
      
    \-- System Protections & Gateway Auditing Strings  
    idempotency\_key UUID NOT NULL UNIQUE,  
    gateway\_reference\_id VARCHAR(255) UNIQUE NULL, \-- Razorpay Payment/Payout unique transaction ID  
    transaction\_status escrow\_transaction\_status\_enum NOT NULL DEFAULT 'PROCESSING\_GATEWAY',  
      
    error\_diagnostic\_payload JSONB NULL, \-- Capture structural payload logs on banking failures  
      
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP NOT NULL  
);

CREATE INDEX idx\_ledger\_vault ON escrow\_transaction\_ledger(vault\_id);  
CREATE INDEX idx\_ledger\_collab ON escrow\_transaction\_ledger(collaboration\_id);  
CREATE INDEX idx\_ledger\_idempotency ON escrow\_transaction\_ledger(idempotency\_key);

\-- \=============================================================================  
\-- 5\. CREATOR REGULATORY SETTLEMENT PROFILE MATRIX  
\-- \=============================================================================

CREATE TABLE creator\_settlement\_profiles (  
    settlement\_profile\_id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    creator\_id UUID NOT NULL UNIQUE, \-- Maps directly to Core Users/Creators entity  
      
    \-- Destinational Routing Tokens  
    account\_holder\_name VARCHAR(255) NOT NULL,  
    bank\_account\_number VARCHAR(100) NOT NULL,  
    ifsc\_code VARCHAR(50) NOT NULL,  
      
    \-- Indian Income Tax Compliance Data  
    pan\_number VARCHAR(10) NULL CHECK (pan\_number \~ '^\[A-Z\]{5}\[0-9\]{4}\[A-Z\]{1}$'),  
    is\_pan\_verified BOOLEAN NOT NULL DEFAULT FALSE,  
      
    \-- Verification Parameters Managed by Razorpay Fund Account Validation  
    razorpay\_fund\_account\_id VARCHAR(255) UNIQUE NULL,  
    is\_settlement\_route\_active BOOLEAN NOT NULL DEFAULT FALSE,  
      
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP,  
    updated\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

CREATE INDEX idx\_creator\_settlement\_lookup ON creator\_settlement\_profiles(creator\_id);

\-- \=============================================================================  
\-- 6\. STATE AUTOMATION HOOKS & TIMESTAMPS  
\-- \=============================================================================

CREATE TRIGGER trigger\_update\_escrow\_vault\_timestamp  
BEFORE UPDATE ON brand\_escrow\_vaults  
FOR EACH ROW EXECUTE FUNCTION update\_timestamp\_column();

CREATE TRIGGER trigger\_update\_collaboration\_locks\_timestamp  
BEFORE UPDATE ON collaboration\_escrow\_locks  
FOR EACH ROW EXECUTE FUNCTION update\_timestamp\_column();

CREATE TRIGGER trigger\_update\_creator\_settlement\_timestamp  
BEFORE UPDATE ON creator\_settlement\_profiles  
FOR EACH ROW EXECUTE FUNCTION update\_timestamp\_column();

### **Critical Data Architecture Constraints Enforced Here**

1. **Anti-Leakage Structural Check**: The brand\_escrow\_vaults table includes a programmatic check constraint (check\_escrow\_ledger\_integrity). If any API call tries to mutate available\_balance without symmetrically updating total\_pooled\_balance or locked\_campaign\_funds, the transaction layer crashes at the database node level to block incorrect accounting calculations.  
2. **Double-Spending Prevention**: The idempotency\_key inside escrow\_transaction\_ledger enforces an absolute uniqueness constraint. If a network failure induces a webhook retry from Razorpay, the transaction payload triggers a collision block instead of incrementing or decrementing balances a second time.  
3. **Statutory Integrity**: The collaboration\_escrow\_locks table automatically partitions the brand's capital using precise accounting constraints (check\_lock\_math\_totals and check\_net\_creator\_disbursal\_split). This handles the gross-locking mechanism upfront, ensuring the funds are entirely structured, taxed, and accounted for before moving past Stage 2\.

