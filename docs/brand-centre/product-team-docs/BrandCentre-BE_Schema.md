\-- PostgreSQL Dialect  
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\-- \=============================================================================  
\-- GLOBAL FUNCTIONAL TRIGGERS & ENUMERATIONS  
\-- \=============================================================================

\-- AUTOMATION FIX: Native global update trigger function to auto-update timestamp markers  
CREATE OR REPLACE FUNCTION update\_timestamp\_column()  
RETURNS TRIGGER AS $$  
BEGIN  
    NEW.updated\_at \= CURRENT\_TIMESTAMP; \-- Forces execution upon operational UPDATE queries  
    RETURN NEW;  
END;  
$$ LANGUAGE plpgsql;

\-- Onboarding & Pipeline State Enumerations  
CREATE TYPE scan\_status\_enum AS ENUM ('PENDING', 'PROCESSING', 'COMPLETE', 'FAILED');  
CREATE TYPE subscription\_tier\_enum AS ENUM ('GROWTH\_STARTER', 'SCALE\_PRO', 'ENTERPRISE\_FLYWHEEL');  
CREATE TYPE subscription\_status\_enum AS ENUM ('ACTIVE', 'PAST\_DUE', 'CANCELED', 'TRIALING');  
CREATE TYPE budget\_allocation\_phase\_enum AS ENUM ('PHASE\_1\_COLD\_START', 'PHASE\_2\_SELF\_HEALING');  
CREATE TYPE priority\_rank\_enum AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'NEGLIGIBLE');  
CREATE TYPE dynamic\_action\_type\_enum AS ENUM ('PUBLISH\_NEW\_TRACK', 'PAUSE\_ACTIVE\_BRIEF');  
CREATE TYPE campaign\_lifecycle\_maturity\_enum AS ENUM ('DRAFT\_PLANNER', 'LIVE\_NO\_APPLICANTS', 'LIVE\_PENDING\_APPROVALS', 'FULLY\_COMMITTED\_ESCROW');

\-- Flexible routing variables for diverse vertical flows  
CREATE TYPE brand\_industry\_routing\_enum AS ENUM ('D2C\_SKINCARE', 'SAAS\_PRODUCT', 'HEALTHCARE\_TREATMENT', 'OFFLINE\_EXPERIENCE');  
CREATE TYPE dynamic\_entity\_type\_enum AS ENUM ('PRODUCT', 'MODULE', 'TREATMENT', 'EXPERIENCE');

\-- \=============================================================================  
\-- PHASE 1: CORE BRAND WORKSPACE & IDENTITY INFRASTRUCTURE  
\-- \=============================================================================

CREATE TABLE brands (  
    brand\_id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    company\_name VARCHAR(255) NOT NULL,  
      
    \-- LOGICAL GATEKEEPING: Restricts double onboarding via URL normalization strings  
    website\_url VARCHAR(255) NOT NULL UNIQUE,  
    industry\_vertical VARCHAR(100) NOT NULL DEFAULT 'D2C\_Skincare',  
    country VARCHAR(100) NOT NULL,  
    currency VARCHAR(10) NOT NULL,  
      
    \-- Social Handles, Niches & Routings  
    ig\_handle VARCHAR(100) NULL,  
    yt\_handle VARCHAR(100) NULL,  
    tiktok\_handle VARCHAR(100) NULL,  
    sub\_industry VARCHAR(100) NULL,  
    industry\_niche VARCHAR(100) NULL,  
    brand\_routing\_type brand\_industry\_routing\_enum NOT NULL DEFAULT 'D2C\_SKINCARE',  
    lifecycle\_stage VARCHAR(100) DEFAULT 'GROWTH\_STAGE',  
      
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP,  
    updated\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);  
CREATE INDEX idx\_brands\_website\_url ON brands(website\_url);

\-- Instantiate update timestamp trigger for auto-updating tracking fields  
CREATE TRIGGER trigger\_update\_brands\_timestamp  
BEFORE UPDATE ON brands  
FOR EACH ROW EXECUTE FUNCTION update\_timestamp\_column();

CREATE TABLE brand\_users (  
    user\_id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    brand\_id UUID REFERENCES brands(brand\_id) ON DELETE CASCADE,  
    first\_name VARCHAR(100) NOT NULL,  
    last\_name VARCHAR(100) NOT NULL,  
      
    \-- SYSTEM DESIGN NOTE: Kept global uniqueness for single-workspace infrastructure.  
    \-- For future Multi-Workspace Agency product paths, separate credentials into an accounts entity mapping node.  
    email VARCHAR(255) NOT NULL UNIQUE,  
    password\_hash VARCHAR(255) NOT NULL,

    \-- Email Verification Infrastructure  
    is\_email\_verified BOOLEAN DEFAULT FALSE,  
    email\_verification\_token VARCHAR(255) NULL,  
    token\_expires\_at TIMESTAMP WITH TIME ZONE NULL,  
    verified\_at TIMESTAMP WITH TIME ZONE NULL,

    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);  
CREATE INDEX idx\_brand\_users\_email ON brand\_users(email);

\-- Structured Audience Persona Card Carousel Table  
CREATE TABLE brand\_audience\_personas (  
    persona\_id UUID PRIMARY KEY DEFAULT gen\_random\_

\-- PostgreSQL Dialect  
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\-- \=============================================================================  
\-- GLOBAL FUNCTIONAL TRIGGERS & ENUMERATIONS  
\-- \=============================================================================

\-- AUTOMATION FIX: Native global update trigger function to auto-update timestamp markers  
CREATE OR REPLACE FUNCTION update\_timestamp\_column()  
RETURNS TRIGGER AS $$  
BEGIN  
    NEW.updated\_at \= CURRENT\_TIMESTAMP; \-- Forces execution upon operational UPDATE queries  
    RETURN NEW;  
END;  
$$ LANGUAGE plpgsql;

\-- Onboarding & Pipeline State Enumerations  
CREATE TYPE scan\_status\_enum AS ENUM ('PENDING', 'PROCESSING', 'COMPLETE', 'FAILED');  
CREATE TYPE subscription\_tier\_enum AS ENUM ('GROWTH\_STARTER', 'SCALE\_PRO', 'ENTERPRISE\_FLYWHEEL');  
CREATE TYPE subscription\_status\_enum AS ENUM ('ACTIVE', 'PAST\_DUE', 'CANCELED', 'TRIALING');  
CREATE TYPE budget\_allocation\_phase\_enum AS ENUM ('PHASE\_1\_COLD\_START', 'PHASE\_2\_SELF\_HEALING');  
CREATE TYPE priority\_rank\_enum AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'NEGLIGIBLE');  
CREATE TYPE dynamic\_action\_type\_enum AS ENUM ('PUBLISH\_NEW\_TRACK', 'PAUSE\_ACTIVE\_BRIEF');  
CREATE TYPE campaign\_lifecycle\_maturity\_enum AS ENUM ('DRAFT\_PLANNER', 'LIVE\_NO\_APPLICANTS', 'LIVE\_PENDING\_APPROVALS', 'FULLY\_COMMITTED\_ESCROW');

\-- Flexible routing variables for diverse vertical flows  
CREATE TYPE brand\_industry\_routing\_enum AS ENUM ('D2C\_SKINCARE', 'SAAS\_PRODUCT', 'HEALTHCARE\_TREATMENT', 'OFFLINE\_EXPERIENCE');  
CREATE TYPE dynamic\_entity\_type\_enum AS ENUM ('PRODUCT', 'MODULE', 'TREATMENT', 'EXPERIENCE');

\-- \=============================================================================  
\-- PHASE 1: CORE BRAND WORKSPACE & IDENTITY INFRASTRUCTURE  
\-- \=============================================================================

CREATE TABLE brands (  
    brand\_id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    company\_name VARCHAR(255) NOT NULL,  
      
    \-- LOGICAL GATEKEEPING: Restricts double onboarding via URL normalization strings  
    website\_url VARCHAR(255) NOT NULL UNIQUE,  
    industry\_vertical VARCHAR(100) NOT NULL DEFAULT 'D2C\_Skincare',  
    country VARCHAR(100) NOT NULL,  
    currency VARCHAR(10) NOT NULL,  
      
    \-- Social Handles, Niches & Routings  
    ig\_handle VARCHAR(100) NULL,  
    yt\_handle VARCHAR(100) NULL,  
    tiktok\_handle VARCHAR(100) NULL,  
    sub\_industry VARCHAR(100) NULL,  
    industry\_niche VARCHAR(100) NULL,  
    brand\_routing\_type brand\_industry\_routing\_enum NOT NULL DEFAULT 'D2C\_SKINCARE',  
    lifecycle\_stage VARCHAR(100) DEFAULT 'GROWTH\_STAGE',  
      
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP,  
    updated\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);  
CREATE INDEX idx\_brands\_website\_url ON brands(website\_url);

\-- Instantiate update timestamp trigger for auto-updating tracking fields  
CREATE TRIGGER trigger\_update\_brands\_timestamp  
BEFORE UPDATE ON brands  
FOR EACH ROW EXECUTE FUNCTION update\_timestamp\_column();

CREATE TABLE brand\_users (  
    user\_id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    brand\_id UUID REFERENCES brands(brand\_id) ON DELETE CASCADE,  
    first\_name VARCHAR(100) NOT NULL,  
    last\_name VARCHAR(100) NOT NULL,  
      
    \-- SYSTEM DESIGN NOTE: Kept global uniqueness for single-workspace infrastructure.  
    \-- For future Multi-Workspace Agency product paths, separate credentials into an accounts entity mapping node.  
    email VARCHAR(255) NOT NULL UNIQUE,  
    password\_hash VARCHAR(255) NOT NULL,

    \-- Email Verification Infrastructure  
    is\_email\_verified BOOLEAN DEFAULT FALSE,  
    email\_verification\_token VARCHAR(255) NULL,  
    token\_expires\_at TIMESTAMP WITH TIME ZONE NULL,  
    verified\_at TIMESTAMP WITH TIME ZONE NULL,

    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);  
CREATE INDEX idx\_brand\_users\_email ON brand\_users(email);

\-- Structured Audience Persona Card Carousel Table  
CREATE TABLE brand\_audience\_personas (  
    persona\_id UUID PRIMARY KEY DEFAULT gen\_random\_

# 