\-- Extended Lifecycle & Workflow Phase Enums  
CREATE TYPE production\_phase AS ENUM (  
    'INBOUND\_INVITE',       \-- Pending Applications: Received brand invitation  
    'APPLICATION\_REVIEW',   \-- Pending Applications: Sent application under review  
    'SHORTLISTED',          \-- Pending Applications: Profile shortlisted, awaiting finalization  
    'LOGISTICS\_TRANSIT',    \-- Active Production: Product sample package shipped  
    'CONTENT\_DRAFTING',     \-- Active Production: Sample received, content in production  
    'SAFETY\_REVIEW',        \-- Active Production: Draft uploaded, awaiting brand safety review  
    'LIVE\_SCRAPING',        \-- Active Production: Content live, streaming telemetry metrics  
    'ARCHIVED\_COMPLETED',   \-- History Cluster: Successfully settled contract milestone  
    'ARCHIVED\_CLOSED'       \-- History Cluster: Rejected, cancelled, expired, or breached  
);

CREATE TYPE draft\_review\_status AS ENUM (  
    'AWAITING\_REVIEW',  
    'APPROVED',  
    'REVISION\_REQUESTED'  
);

\-- Core Collaboration Workflow Registry  
CREATE TABLE uce\_campaign\_collaborations (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    campaign\_id UUID NOT NULL,  
    campaign\_name VARCHAR(255) NOT NULL,  
    creator\_profile\_id UUID NOT NULL,  
    current\_phase production\_phase NOT NULL DEFAULT 'APPLICATION\_REVIEW',  
    agreed\_compensation\_fee NUMERIC(10, 2\) NOT NULL CHECK (agreed\_compensation\_fee \>= 0.00),  
    match\_matrix\_score\_percentage INT CHECK (match\_matrix\_score\_percentage BETWEEN 0 AND 100),  
    content\_format\_type VARCHAR(50) NOT NULL, \-- e.g., 'INSTAGRAM\_REEL', 'TIKTOK\_VIDEO'  
      
    \-- Deadline Operational Triggers  
    production\_deadline\_at TIMESTAMP WITH TIME ZONE,  
    action\_required\_by\_role VARCHAR(20) NOT NULL DEFAULT 'BRAND' CHECK (action\_required\_by\_role IN ('CREATOR', 'BRAND', 'NONE')),  
      
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP,  
    updated\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

\-- Logistics Handling Registry (Active Production: Logistics Track Phase)  
CREATE TABLE collaboration\_logistics (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    collaboration\_id UUID NOT NULL UNIQUE REFERENCES uce\_campaign\_collaborations(id) ON DELETE RESTRICT,  
    carrier\_name VARCHAR(100) NOT NULL,  
    tracking\_id VARCHAR(100) NOT NULL,  
    estimated\_delivery\_at TIMESTAMP WITH TIME ZONE,  
    actual\_delivered\_at TIMESTAMP WITH TIME ZONE,  
    is\_received\_by\_creator BOOLEAN DEFAULT FALSE,  
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP,  
    updated\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

\-- Iterative Draft Submission Register (Active Production: Creative & Compliance Phases)  
CREATE TABLE collaboration\_content\_drafts (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    collaboration\_id UUID NOT NULL REFERENCES uce\_campaign\_collaborations(id) ON DELETE RESTRICT,  
    draft\_url TEXT NOT NULL,  
    submission\_version INT NOT NULL DEFAULT 1,  
    review\_state draft\_review\_status NOT NULL DEFAULT 'AWAITING\_REVIEW',  
    brand\_safety\_feedback TEXT, \-- Populated if REVISION\_REQUESTED  
    submitted\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP,  
    reviewed\_at TIMESTAMP WITH TIME ZONE  
);

\-- Real-time Social Telemetry Snapshots (Active Production: Live Tracking Performance Network)  
CREATE TABLE collaboration\_live\_telemetry (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    collaboration\_id UUID NOT NULL UNIQUE REFERENCES uce\_campaign\_collaborations(id) ON DELETE RESTRICT,  
    content\_live\_url TEXT NOT NULL,  
    total\_views INT DEFAULT 0 CHECK (total\_views \>= 0),  
    total\_reach INT DEFAULT 0 CHECK (total\_reach \>= 0),  
    engagement\_rate NUMERIC(5,2) DEFAULT 0.00,  
    days\_public\_count INT DEFAULT 0 CHECK (days\_public\_count \>= 0),  
    last\_scraped\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

\-- HIGH-PERFORMANCE CRITICAL OPERATIONAL INDEXES  
\-- 1\. Optimizes Panic Panel calculations scanning for overdue deadlines and creator blockages  
CREATE INDEX idx\_panic\_panel\_evaluation   
ON uce\_campaign\_collaborations (creator\_profile\_id, action\_required\_by\_role, production\_deadline\_at)   
WHERE current\_phase IN ('LOGISTICS\_TRANSIT', 'CONTENT\_DRAFTING', 'SAFETY\_REVIEW', 'LIVE\_SCRAPING');

\-- 2\. Fast multi-state query optimizations for the primary Dual-State workspace toggles  
CREATE INDEX idx\_workspace\_phase\_router   
ON uce\_campaign\_collaborations (creator\_profile\_id, current\_phase);

\-- 3\. Composite tracking for active content review sequences  
CREATE INDEX idx\_draft\_review\_lookup   
ON collaboration\_content\_drafts (collaboration\_id, review\_state);  
