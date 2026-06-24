We have a highly structural, multi-tenant foundational schema ready to go. Based on the backend engineering documentation you uploaded (backend- Brand Centre (3).docx and backend- Brand onboarding journey doc (1).docx), the underlying database layer is already explicitly modeled in PostgreSQL.  
The next step is to **bridge the gap between our React 18 frontend code and this existing database schema** by creating the data fetching layer.  
Here is a quick look at the exact database models already defined in your documents that correspond directly to our **Home Workspace Console**:

### **1\. The Core Multi-Tenant Topology (**brands**)**

Every action taken on the canvas (like scoping by BRAND\_CENTRE) maps to this root table:  
SQL  
CREATE TABLE brands (  
    brand\_id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    company\_name VARCHAR(255) NOT NULL,  
    website\_url VARCHAR(512) NOT NULL,  
    brand\_vertical VARCHAR(100) DEFAULT 'D2C\_SKINCARE',  
    lifecycle\_stage VARCHAR(100) DEFAULT 'GROWTH\_STAGE',  
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP,  
    updated\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

### **2\. The Context-Scoped Personas (**brand\_audience\_personas**)**

When the user switches the AI console scope to BRAND\_CENTRE or requests audience deep dives, it queries this relation:  
SQL  
CREATE TABLE brand\_audience\_personas (  
    persona\_id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    brand\_id UUID REFERENCES brands(brand\_id) ON DELETE CASCADE,  
    persona\_name VARCHAR(150) NOT NULL,  
    demographics\_json JSONB NOT NULL, \-- Geo windows, explicit interests  
    psychographics\_text TEXT,  
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

### **3\. The Progressive Form Destination (Campaign Lifecycles)**

When a user finishes filling out the multi-turn slot form for the **"Retinol Serum Setup"** campaign, the system triggers an enumeration state transition straight into this lifecycle track:

* **Target Enum Matrix:** campaign\_lifecycle\_maturity\_enum (DRAFT\_PLANNER, LIVE\_NO\_APPLICANTS, LIVE\_PENDING\_APPROVALS, FULLY\_COMMITTED\_ESCROW)  
* These campaign entries link directly back to the three-point constraint table (selling\_points VARCHAR(255)\[\] NOT NULL) defined within your infrastructure limits.

### **Recommended Next Step: Build the Endpoints & Zod Validation Layer**

To make this workspace operational, we should define the **TypeScript types, Zod schemas, and API handlers** that connect our interactive UI console elements to these exact tables.  
Would you like to write the **Zod runtime validation schemas** and API contracts to handle saving data when the user clicks "Confirm Parameters & Proceed" on the campaign slot form?  
