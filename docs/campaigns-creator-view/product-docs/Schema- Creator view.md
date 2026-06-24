To fully support the architectural states, dynamic 3-step application workflows, and multi-industry parameter mutations established in our master specifications, our creator-facing relational data engine must map cleanly to your platform core.  
This schema relies on PostgreSQL's advanced typing systems and relational optimization features to efficiently process workloads like multi-variant selection engines, secure escrow milestones, and fast real-time filtering for the Show Match Eligible Only toggle.

## **1\. Custom Types & Enumerations**

SQL  
\-- Core visibility scopes matching database row-level enforcement  
CREATE TYPE campaign\_visibility\_scope AS ENUM ('EVERYONE', 'ELIGIBLE\_ONLY', 'INVITE\_ONLY');

\-- Industry verticals triggering dynamic UI overrides and compliance logic  
CREATE TYPE industry\_vertical AS ENUM ('GENERAL\_D2C', 'HEALTHCARE\_MEDICAL', 'AI\_SAAS\_TECH', 'OFFLINE\_EXPERIENTIAL');

\-- Lifecycle states of a collaboration workstream iteration  
CREATE TYPE collaboration\_status AS ENUM (  
    'INVITED',   
    'APPLIED',   
    'APPROVED',   
    'REJECTED',   
    'ESCROW\_LOCKED',   
    'DELIVERED',   
    'COMPLETED',   
    'SUSPENDED'  
);

\-- Content platform medium format type mapping  
CREATE TYPE platform\_content\_format AS ENUM ('INSTAGRAM\_REEL', 'INSTAGRAM\_STORY', 'TIKTOK\_VIDEO', 'YOUTUBE\_SHORTS');

## **2\. Relational Core Tables**

### creator\_profiles

Extends the base platform authentication system with social graph data layers, real-time telemetry, and audience matrix profiles.  
SQL  
CREATE TABLE creator\_profiles (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    user\_id UUID NOT NULL UNIQUE, \-- References core platform auth.users  
    connected\_instagram\_handle VARCHAR(100) DEFAULT NULL,  
    connected\_tiktok\_handle VARCHAR(100) DEFAULT NULL,  
    is\_social\_connected BOOLEAN GENERATED ALWAYS AS (connected\_instagram\_handle IS NOT NULL OR connected\_tiktok\_handle IS NOT NULL) STORED,  
    follower\_count INT DEFAULT 0 CHECK (follower\_count \>= 0),  
    primary\_region VARCHAR(10) NOT NULL, \-- ISO-2 Code format (e.g., 'US', 'IN')  
      
    \-- Semi-structured data matching demographic parameters securely  
    \-- Structure: {"age\_distribution": {"18-24": 0.45, "25-34": 0.35}, "top\_countries": {"US": 0.82, "UK": 0.10}, "gender\_skew": {"female": 0.72}}  
    audience\_demographics\_matrix JSONB NOT NULL DEFAULT '{}'::jsonb,  
      
    compliance\_verified BOOLEAN DEFAULT FALSE,  
    verification\_credentials\_ledger JSONB DEFAULT NULL, \-- Verified medical licenses/credentials  
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP,  
    updated\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

### campaign\_products

The physical or digital repository options configured by the brand for targeted creator content sampling campaigns.  
SQL  
CREATE TABLE campaign\_products (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    campaign\_id UUID NOT NULL, \-- References core platform campaigns.id  
    product\_name VARCHAR(255) NOT NULL,  
    retail\_price\_numeric NUMERIC(10, 2) NOT NULL CHECK (retail\_price\_numeric \>= 0.00),  
    currency\_code VARCHAR(3) NOT NULL DEFAULT 'USD',  
    pdp\_url TEXT NOT NULL,  
    image\_url TEXT NOT NULL,  
    inventory\_allocation\_count INT NOT NULL DEFAULT 0 CHECK (inventory\_allocation\_count \>= 0),  
    unique\_selling\_points TEXT\[\] NOT NULL DEFAULT '{}',  
    do\_not\_say\_list TEXT\[\] NOT NULL DEFAULT '{}',  
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

### campaign\_brief\_tracks

Platform creative outlines, specific delivery parameters, and execution timelines mapped directly to campaign setups or specific target items.  
SQL  
CREATE TABLE campaign\_brief\_tracks (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    campaign\_id UUID NOT NULL,  
    product\_id UUID REFERENCES campaign\_products(id) ON DELETE SET NULL, \-- Nullable if sitewide track  
    content\_format\_type platform\_content\_format NOT NULL,  
    delivery\_quantity\_count INT NOT NULL DEFAULT 1 CHECK (delivery\_quantity\_count \> 0),  
    execution\_timeline\_days INT NOT NULL DEFAULT 15 CHECK (execution\_timeline\_days \> 0),  
    creative\_direction\_narrative TEXT NOT NULL,  
    visual\_directives\_array TEXT\[\] NOT NULL DEFAULT '{}',  
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

### uce\_campaign\_collaborations

The central state hub mapping incoming invitations, open pipeline applicants, dynamic product selections, and financial protection links.  
SQL  
CREATE TABLE uce\_campaign\_collaborations (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    campaign\_id UUID NOT NULL,  
    creator\_profile\_id UUID NOT NULL REFERENCES creator\_profiles(id) ON DELETE RESTRICT,  
      
    \-- Nullable allocations during pre-submission wizard states (State A2/B initialization)  
    product\_id UUID REFERENCES campaign\_products(id) ON DELETE RESTRICT,  
    brief\_track\_id UUID REFERENCES campaign\_brief\_tracks(id) ON DELETE RESTRICT,  
      
    \-- Structural state parameters for target validation  
    is\_invited BOOLEAN NOT NULL DEFAULT FALSE,  
    invitation\_source\_channel VARCHAR(50) DEFAULT NULL, \-- e.g., 'META\_MARKETPLACE\_API\_DM'  
    match\_matrix\_score\_percentage INT CHECK (match\_matrix\_score\_percentage BETWEEN 0 AND 100),  
      
    workstream\_status collaboration\_status NOT NULL DEFAULT 'APPLIED',  
    agreed\_compensation\_fee NUMERIC(10, 2) NOT NULL CHECK (agreed\_compensation\_fee \>= 0.00),  
      
    \-- Legal and compliance check markers  
    terms\_accepted\_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,  
    content\_live\_url TEXT DEFAULT NULL,  
      
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP,  
    updated\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP,

    \-- Data integrity constraint to avoid messy duplicate application submission states  
    CONSTRAINT unique\_creator\_campaign\_collaboration UNIQUE (campaign\_id, creator\_profile\_id)  
);

### escrow\_milestone\_ledgers

Maintains records for secure milestone processing, ensuring financial transactions remain systematically locked pending content verification.  
SQL  
CREATE TABLE escrow\_milestone\_ledgers (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    collaboration\_id UUID NOT NULL UNIQUE REFERENCES uce\_campaign\_collaborations(id) ON DELETE RESTRICT,  
    amount\_locked\_numeric NUMERIC(10, 2) NOT NULL CHECK (amount\_locked\_numeric \>= 0.00),  
    escrow\_status VARCHAR(30) NOT NULL DEFAULT 'PENDING'   
        CHECK (escrow\_status IN ('PENDING', 'FUNDED', 'RELEASED', 'REFUNDED\_BRAND')),  
    blockchain\_ledger\_tx\_hash VARCHAR(64) DEFAULT NULL, \-- Hash identifier reference tracking  
    funds\_funded\_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,  
    funds\_released\_at TIMESTAMP WITH TIME ZONE DEFAULT NULL  
);

## **3\. Highly Optimized Performance Indexes**

To ensure instant screen updates when filtering, matching, or validating inbound tracking tokens, the platform relies on targeted composite and inverted index models.  
SQL  
\-- 1\. Optimizes the 'Show Match Eligible Only' filter sequence by mapping location and connections instantly  
CREATE INDEX idx\_creator\_eligibility\_lookup   
ON creator\_profiles (is\_social\_connected, primary\_region, follower\_count);

\-- 2\. Fast GIN indexing strategy to query nested demographic ranges or country ratios efficiently  
CREATE INDEX idx\_creator\_audience\_jsonb   
ON creator\_profiles USING gin (audience\_demographics\_matrix);

\-- 3\. Accelerates Phase 1 token lookup speeds for priority links arriving via external DMs  
CREATE INDEX idx\_collab\_invite\_handshake   
ON uce\_campaign\_collaborations (campaign\_id, creator\_profile\_id)   
WHERE is\_invited \= TRUE;

\-- 4\. Fast execution tracker scanning for active, open applicant workflows inside rows  
CREATE INDEX idx\_collab\_status\_tracker   
ON uce\_campaign\_collaborations (workstream\_status);

## **4\. Real-time Synchronization Automation**

This trigger rule ensures that whenever a creator edits their selections or updates an entry within the multi-step application wizard tracking sheet, the tracking timestamp updates dynamically.  
SQL  
CREATE OR REPLACE FUNCTION update\_timestamp\_column()  
RETURNS TRIGGER AS $$  
BEGIN  
    NEW.updated\_at \= CURRENT\_TIMESTAMP;  
    RETURN NEW;  
END;  
$$ LANGUAGE plpgsql;

CREATE TRIGGER update\_creator\_profile\_modtime  
    BEFORE UPDATE ON creator\_profiles  
    FOR EACH ROW EXECUTE FUNCTION update\_timestamp\_column();

CREATE TRIGGER update\_uce\_collaboration\_modtime  
    BEFORE UPDATE ON uce\_campaign\_collaborations  
    FOR EACH ROW EXECUTE FUNCTION update\_timestamp\_column();

