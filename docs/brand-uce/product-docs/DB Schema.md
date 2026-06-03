### **PART A: Integrated PostgreSQL Schema Setup**

SQL  
\-- \=============================================================================  
\-- 1\. GLOBAL SYSTEM ENUMERATIONS & CUSTOM STATE DOMAINS  
\-- \=============================================================================  
CREATE TYPE campaign\_status\_enum AS ENUM (  
    'DRAFT',   
    'ACTIVE',   
    'PAUSED',   
    'COMPLETED'  
);

CREATE TYPE timeline\_structure\_enum AS ENUM (  
    'FIXED\_DATES',   
    'DYNAMIC\_MILESTONES'  
);

CREATE TYPE campaign\_objective\_enum AS ENUM (  
    'BRAND\_AWARENESS',   
    'TRAFFIC\_CLICKS',   
    'SALES\_CONVERSIONS'  
);

CREATE TYPE compensation\_type\_enum AS ENUM (  
    'FIXED\_FEE',   
    'NEGOTIABLE'  
);

CREATE TYPE payout\_terms\_enum AS ENUM (  
    'IMMEDIATE',   
    'NET\_7',   
    'NET\_15',   
    'NET\_30'  
);

CREATE TYPE collab\_status\_enum AS ENUM (  
    'PROSPECT\_CURATED',  
    'PROSPECT\_INVITED',  
    'APPLICANT\_PENDING',  
    'APPLICANT\_SHORTLISTED',  
    'APPLICANT\_REJECTED',  
    'ACTIVE\_WORKFLOW',  
    'TERMINATED\_CANCELED',  
    'ARCHIVED\_COMPLETE'  
);

CREATE TYPE collabs\_milestone\_stage\_enum AS ENUM (  
    'STAGE\_1\_NEGOTIATION',  
    'STAGE\_2\_SECUREMENT',  
    'STAGE\_3\_LOGISTICS',  
    'STAGE\_4\_CONTENT\_REVIEW',  
    'STAGE\_5\_PUBLISHING',  
    'STAGE\_6\_FEEDBACK\_SYNC'  
);

CREATE TYPE pipeline\_health\_status\_enum AS ENUM (  
    'ON\_TRACK',  
    'APPROACHING\_DEADLINE',  
    'ACTION\_OVERDUE',  
    'SYSTEM\_HOLD'  
);

CREATE TYPE negotiation\_sub\_state\_enum AS ENUM (  
    'BRAND\_COUNTER',  
    'CREATOR\_COUNTER',  
    'FINAL\_OFFER\_PENDING'  
);

CREATE TYPE securement\_sub\_state\_enum AS ENUM (  
    'AWAITING\_FUNDING',  
    'AWAITING\_SIGNATURE'  
);

CREATE TYPE logistics\_sub\_state\_enum AS ENUM (  
    'AWAITING\_DISPATCH',  
    'IN\_TRANSIT',  
    'DELIVERY\_EXCEPTION'  
);

CREATE TYPE review\_sub\_state\_enum AS ENUM (  
    'INITIAL\_DRAFT\_SUBMITTED',  
    'REVISION\_ROUND\_ACTIVE',  
    'CONTENT\_HALTED\_LOCK'  
);

CREATE TYPE publishing\_sub\_state\_enum AS ENUM (  
    'AWAITING\_LIVE\_POST',  
    'COMPLIANCE\_CHECK\_ACTIVE'  
);

CREATE TYPE media\_platform\_enum AS ENUM (  
    'INSTAGRAM',  
    'TIKTOK',  
    'YOUTUBE'  
);

\-- \=============================================================================  
\-- 2\. MASTER CAMPAIGN CORE INFRASTRUCTURE & AGGREGATES  
\-- \=============================================================================  
CREATE TABLE campaigns (  
    campaign\_id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    brand\_id UUID NOT NULL,  
    campaign\_name VARCHAR(255) NOT NULL,  
    current\_status campaign\_status\_enum NOT NULL DEFAULT 'DRAFT',  
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP,  
    updated\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

CREATE TABLE campaign\_performance\_aggregates (  
    campaign\_id UUID PRIMARY KEY REFERENCES campaigns(campaign\_id) ON DELETE CASCADE,  
    total\_spend\_to\_date NUMERIC(14,2) NOT NULL DEFAULT 0.00,  
    total\_impressions\_count BIGINT NOT NULL DEFAULT 0,  
    total\_clicks\_count BIGINT NOT NULL DEFAULT 0,  
    total\_conversions\_count INT NOT NULL DEFAULT 0,  
    total\_prospects\_count INT NOT NULL DEFAULT 0,  
    total\_applicants\_count INT NOT NULL DEFAULT 0,  
    total\_active\_collabs\_count INT NOT NULL DEFAULT 0,  
    updated\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

\-- \=============================================================================  
\-- 3\. STRATEGIC CAMPAIGN SETUP MODELS (CREATE CAMPAIGN METADATA)  
\-- \=============================================================================  
CREATE TABLE campaign\_strategy (  
    campaign\_id UUID PRIMARY KEY REFERENCES campaigns(campaign\_id) ON DELETE CASCADE,  
    timeline\_type timeline\_structure\_enum NOT NULL,  
    fixed\_start\_date TIMESTAMP WITH TIME ZONE NULL,  
    fixed\_end\_date TIMESTAMP WITH TIME ZONE NULL,  
    dynamic\_days\_limit INT NULL,  
    core\_objective campaign\_objective\_enum NOT NULL,  
    platform\_deliverables JSONB NOT NULL,   
    CONSTRAINT chk\_timeline\_integrity CHECK (  
        (timeline\_type \= 'FIXED\_DATES' AND fixed\_start\_date IS NOT NULL AND fixed\_end\_date IS NOT NULL) OR  
        (timeline\_type \= 'DYNAMIC\_MILESTONES' AND dynamic\_days\_limit IS NOT NULL)  
    )  
);

CREATE TABLE campaign\_targeting (  
    campaign\_id UUID PRIMARY KEY REFERENCES campaigns(campaign\_id) ON DELETE CASCADE,  
    industry\_vertical VARCHAR(100) NOT NULL,  
    creator\_archetypes TEXT\[\] NOT NULL DEFAULT '{}',  
    follower\_tiers TEXT\[\] NOT NULL DEFAULT '{}',  
    audience\_age\_min INT NOT NULL DEFAULT 18 CHECK (audience\_age\_min \>= 13),  
    audience\_age\_max INT NOT NULL DEFAULT 65 CHECK (audience\_age\_max \>= audience\_age\_min),  
    audience\_gender VARCHAR(50) NOT NULL DEFAULT 'ALL',  
    target\_locations TEXT\[\] NOT NULL DEFAULT '{}',  
    disqualifying\_keywords TEXT\[\] NOT NULL DEFAULT '{}'  
);

CREATE TABLE campaign\_commercials (  
    campaign\_id UUID PRIMARY KEY REFERENCES campaigns(campaign\_id) ON DELETE CASCADE,  
    compensation\_type compensation\_type\_enum NOT NULL,  
    fixed\_fee\_amount NUMERIC(12,2) NULL DEFAULT 0.00,  
    negotiable\_min\_fee NUMERIC(12,2) NULL DEFAULT 0.00,  
    negotiable\_max\_fee NUMERIC(12,2) NULL DEFAULT 0.00,  
    total\_campaign\_budget\_pool NUMERIC(14,2) NOT NULL CHECK (total\_campaign\_budget\_pool \> 0.00),  
    advance\_payment\_percentage INT NOT NULL DEFAULT 30 CHECK (advance\_payment\_percentage \>= 30 AND advance\_payment\_percentage \<= 100),  
    final\_balance\_terms payout\_terms\_enum NOT NULL DEFAULT 'NET\_30',  
    CONSTRAINT chk\_fee\_bounds CHECK (  
        (compensation\_type \= 'FIXED\_FEE' AND fixed\_fee\_amount \> 0.00) OR  
        (compensation\_type \= 'NEGOTIABLE' AND negotiable\_min\_fee \>= 0.00 AND negotiable\_max\_fee \> negotiable\_min\_fee)  
    )  
);

\-- \=============================================================================  
\-- 4\. SUPPLY CHAIN & BRIEF MANAGEMENT COMPONENTS  
\-- \=============================================================================  
CREATE TABLE campaign\_products (  
    product\_id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    campaign\_id UUID NOT NULL REFERENCES campaigns(campaign\_id) ON DELETE CASCADE,  
    sku\_code VARCHAR(150) NOT NULL,  
    product\_name VARCHAR(255) NOT NULL,  
    inventory\_count INT NOT NULL DEFAULT 0 CHECK (inventory\_count \>= 0),  
    cost\_per\_unit NUMERIC(10,2) NOT NULL DEFAULT 0.00,  
    image\_url TEXT NULL,  
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP,  
    CONSTRAINT unique\_campaign\_sku UNIQUE (campaign\_id, sku\_code)  
);

CREATE TABLE campaign\_briefs (  
    brief\_id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    campaign\_id UUID NOT NULL REFERENCES campaigns(campaign\_id) ON DELETE CASCADE,  
    internal\_title VARCHAR(255) NOT NULL,  
    creative\_guidelines TEXT NOT NULL,  
    required\_platforms media\_platform\_enum\[\] NOT NULL,  
    deliverable\_format\_tags TEXT\[\] NOT NULL,  
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

\-- \=============================================================================  
\-- 5\. CRM STATE MACHINE & MILESTONE TRACKING REGISTRY  
\-- \=============================================================================  
CREATE TABLE campaign\_collaborations (  
    collaboration\_id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    campaign\_id UUID NOT NULL REFERENCES campaigns(campaign\_id) ON DELETE CASCADE,  
    brief\_id UUID NOT NULL REFERENCES campaign\_briefs(brief\_id) ON DELETE RESTRICT,  
    product\_id UUID NULL REFERENCES campaign\_products(product\_id) ON DELETE SET NULL,  
      
    \-- Identity Parameters  
    instagram\_handle VARCHAR(100) NOT NULL,  
    creator\_email VARCHAR(255) NOT NULL,  
    match\_score NUMERIC(5,2) NOT NULL DEFAULT 0.00,  
    vetting\_remark VARCHAR(255) NULL,  
    rejection\_reason VARCHAR(255) NULL,  
      
    \-- State Machine Vectors  
    collab\_status collab\_status\_enum NOT NULL DEFAULT 'PROSPECT\_CURATED',  
    current\_milestone collabs\_milestone\_stage\_enum NOT NULL DEFAULT 'STAGE\_1\_NEGOTIATION',  
    pipeline\_health pipeline\_health\_status\_enum NOT NULL DEFAULT 'ON\_TRACK',  
      
    \-- Nested Lifecycle Control Registers  
    negotiation\_state negotiation\_sub\_state\_enum NULL DEFAULT 'CREATOR\_COUNTER',  
    securement\_state securement\_sub\_state\_enum NULL,  
    logistics\_state logistics\_sub\_state\_enum NULL,  
    review\_state review\_sub\_state\_enum NULL,  
    publishing\_state publishing\_sub\_state\_enum NULL,  
      
    \-- Strict Boundary System Guard Counters  
    negotiation\_round\_count INT NOT NULL DEFAULT 0 CONSTRAINT chk\_negotiation\_limit CHECK (negotiation\_round\_count \<= 2),  
    fulfillment\_issue\_count INT NOT NULL DEFAULT 0 CONSTRAINT chk\_logistics\_limit CHECK (fulfillment\_issue\_count \<= 2),  
    revision\_round\_count INT NOT NULL DEFAULT 0 CONSTRAINT chk\_revision\_limit CHECK (revision\_round\_count \<= 2),  
      
    \-- Commercial Parameters  
    total\_quote NUMERIC(12,2) NOT NULL DEFAULT 0.00,  
    advance\_30\_value NUMERIC(12,2) NOT NULL DEFAULT 0.00,  
    balance\_70\_value NUMERIC(12,2) NOT NULL DEFAULT 0.00,  
      
    \-- Fulfillment Asset References  
    logistics\_carrier VARCHAR(100) NULL,  
    logistics\_tracking\_number VARCHAR(150) NULL,  
    content\_draft\_url TEXT NULL,  
    live\_published\_url TEXT NULL,  
    compliance\_verified BOOLEAN NOT NULL DEFAULT FALSE,  
      
    \-- System Escalation Clocks  
    72h\_auto\_approval\_deadline TIMESTAMP WITH TIME ZONE NULL,  
    current\_milestone\_deadline TIMESTAMP WITH TIME ZONE NOT NULL,  
      
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP,  
    updated\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP,  
      
    CONSTRAINT unique\_campaign\_creator UNIQUE (campaign\_id, instagram\_handle),  
    CONSTRAINT chk\_financial\_balance CHECK (total\_quote \= (advance\_30\_value \+ balance\_70\_value))  
);

\-- Performance Indexes Optimization Parameters for Tabular Feeds  
CREATE INDEX idx\_collab\_crm\_flow ON campaign\_collaborations (campaign\_id, collab\_status, current\_milestone);  
CREATE INDEX idx\_collab\_health\_deadline ON campaign\_collaborations (pipeline\_health, current\_milestone\_deadline ASC);  
CREATE INDEX idx\_collab\_auto\_approval ON campaign\_collaborations (72h\_auto\_approval\_deadline) WHERE 72h\_auto\_approval\_deadline IS NOT NULL;

\-- \=============================================================================  
\-- 6\. AUDIT TELEMETRY SYSTEM LOGS  
\-- \=============================================================================  
CREATE TABLE collaboration\_audit\_logs (  
    log\_id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    collaboration\_id UUID NOT NULL REFERENCES campaign\_collaborations(collaboration\_id) ON DELETE CASCADE,  
    stage\_context collabs\_milestone\_stage\_enum NOT NULL,  
    system\_event\_tag VARCHAR(100) NOT NULL,   
    log\_message\_payload TEXT NOT NULL,  
    actor\_identifier VARCHAR(100) NOT NULL,   
    logged\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

CREATE INDEX idx\_audit\_history ON collaboration\_audit\_logs (collaboration\_id, logged\_at ASC);

\-- \=============================================================================  
\-- 7\. PERFORMANCE ANALYTICS ENGINE REGISTRIES  
\-- \=============================================================================  
CREATE TABLE campaign\_reporting\_snapshots (  
    snapshot\_id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    campaign\_id UUID NOT NULL REFERENCES campaigns(campaign\_id) ON DELETE CASCADE,  
    primary\_objective campaign\_objective\_enum NOT NULL,  
      
    \-- Shared Financial Elements  
    total\_spend\_allocated NUMERIC(12,2) NOT NULL DEFAULT 0.00,  
    total\_earned\_media\_value NUMERIC(12,2) NOT NULL DEFAULT 0.00,  
      
    \-- Awareness Metrics Data Columns  
    total\_verified\_impressions BIGINT NOT NULL DEFAULT 0,  
    total\_verified\_reach BIGINT NOT NULL DEFAULT 0,  
    calculated\_cpm\_rate NUMERIC(10,2) NOT NULL DEFAULT 0.00,  
    calculated\_cpe\_rate NUMERIC(10,2) NOT NULL DEFAULT 0.00,  
      
    \-- Traffic Metrics Data Columns  
    total\_tracked\_link\_clicks BIGINT NOT NULL DEFAULT 0,  
    aggregated\_ctr\_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00,  
    calculated\_cpc\_rate NUMERIC(10,2) NOT NULL DEFAULT 0.00,  
      
    \-- Conversion Metrics Data Columns  
    attributed\_sales\_revenue NUMERIC(14,2) NOT NULL DEFAULT 0.00,  
    attributed\_conversion\_count INT NOT NULL DEFAULT 0,  
    aggregated\_conversion\_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,  
    calculated\_cac\_rate NUMERIC(10,2) NOT NULL DEFAULT 0.00,  
      
    last\_api\_sync\_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,  
    updated\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

CREATE TABLE campaign\_reporting\_timeseries\_hourly (  
    log\_id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    campaign\_id UUID NOT NULL REFERENCES campaigns(campaign\_id) ON DELETE CASCADE,  
    recorded\_hour TIMESTAMP WITH TIME ZONE NOT NULL,  
    hourly\_likes\_count INT NOT NULL DEFAULT 0,  
    hourly\_comments\_count INT NOT NULL DEFAULT 0,  
    hourly\_saves\_count INT NOT NULL DEFAULT 0,  
    hourly\_shares\_count INT NOT NULL DEFAULT 0,  
    hourly\_impressions\_delta INT NOT NULL DEFAULT 0,  
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

CREATE UNIQUE INDEX idx\_reporting\_timeseries\_hourly\_axis ON campaign\_reporting\_timeseries\_hourly (campaign\_id, recorded\_hour DESC);

CREATE TABLE campaign\_reporting\_asset\_gallery (  
    asset\_id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    campaign\_id UUID NOT NULL REFERENCES campaigns(campaign\_id) ON DELETE CASCADE,  
    collaboration\_id UUID NOT NULL REFERENCES campaign\_collaborations(collaboration\_id) ON DELETE CASCADE,  
    instagram\_handle VARCHAR(100) NOT NULL,  
    platform media\_platform\_enum NOT NULL,  
    media\_thumbnail\_url TEXT NOT NULL,  
    high\_res\_source\_download\_url TEXT NOT NULL,  
    engagement\_rate\_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00,  
      
    \-- Premium OAuth Metrics Data Columns  
    saves\_count INT NOT NULL DEFAULT 0,  
    shares\_count INT NOT NULL DEFAULT 0,  
    story\_sticker\_clicks\_count INT NOT NULL DEFAULT 0,  
      
    \-- Paid Media Distribution/Amplification Control Hooks  
    spark\_ad\_authorization\_code VARCHAR(255) NULL,  
    is\_whitelisting\_active BOOLEAN NOT NULL DEFAULT FALSE,  
    published\_at TIMESTAMP WITH TIME ZONE NOT NULL,  
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

CREATE INDEX idx\_gallery\_ranking ON campaign\_reporting\_asset\_gallery (campaign\_id, engagement\_rate\_percentage DESC);  
