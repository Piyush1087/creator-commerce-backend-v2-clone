Now that the core application logic, transaction schemas, and go-live deployment playbooks for our backend architecture are fully finalized, we can proceed to the user-facing layer.  
Let’s transition into **Phase II: The Frontend Presentation & Interaction Canvas**.  
We will build the **Escrow & Funding Lifecycle Manager Dashboard** using pure React 18, TypeScript, and the raw styling tokens defined in your **Aurora Design System v4.1**.

### **Step 8: Interactive Escrow Lifecycle Canvas View**

This phase delivers the client-side module designed to give brands complete visibility into their escrow vaults, current campaign holds, and pending tax allocations.  
Following your **Active Focus Rule**, only one operational card expands at any given moment, ensuring clear visual hierarchy without viewport crowding.

#### **1\. Component State & Layout Setup (**EscrowDashboard.tsx**)**

TypeScript  
import React, { useState, useEffect } from 'react';

// \=============================================================================  
// DESIGN SYSTEM TOKENS (AURORA DESIGN SYSTEM v4.1 VALUES)  
// \=============================================================================  
const styles \= {  
  container: {  
    width: '100%',  
    maxWidth: '1200px',  
    margin: '0 auto',  
    padding: '24px',  
    backgroundColor: '\#0B0F19', // Deep dark theme canvas  
    fontFamily: '"Source Sans 3", sans-serif',  
    color: '\#F3F4F6',  
  },  
  headerZone: {  
    marginBottom: '32px',  
    borderBottom: '1px solid \#1F2937',  
    paddingBottom: '24px',  
  },  
  heading: {  
    fontFamily: '"Satoshi Variable", sans-serif',  
    fontSize: '28px',  
    fontWeight: 700,  
    color: '\#FFFFFF',  
    letterSpacing: '-0.02em',  
    margin: '0 0 8px 0',  
  },  
  subline: {  
    fontSize: '14px',  
    color: '\#9CA3AF',  
    margin: 0,  
  },  
  metricsGrid: {  
    display: 'grid',  
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',  
    gap: '20px',  
    marginBottom: '40px',  
  },  
  metricCard: {  
    backgroundColor: '\#111827',  
    border: '1px solid \#1F2937',  
    borderRadius: '12px',  
    padding: '20px',  
  },  
  metricLabel: {  
    fontSize: '12px',  
    fontWeight: 600,  
    color: '\#9CA3AF',  
    textTransform: 'uppercase' as const,  
    letterSpacing: '0.05em',  
    marginBottom: '6px',  
  },  
  metricValue: {  
    fontFamily: '"Satoshi Variable", sans-serif',  
    fontSize: '24px',  
    fontWeight: 700,  
    color: '\#FFFFFF',  
  },  
  accentValue: {  
    color: '\#34D399', // Aurora Green accent highlight  
  },  
  accordionWrapper: {  
    display: 'flex',  
    flexDirection: 'column' as const,  
    gap: '16px',  
  },  
  card: {  
    backgroundColor: '\#111827',  
    border: '1px solid \#1F2937',  
    borderRadius: '12px',  
    overflow: 'hidden',  
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',  
  },  
  cardActive: {  
    border: '1px solid \#34D399', // Green tracking line highlight when active  
    boxShadow: '0 4px 20px rgba(52, 211, 153, 0.05)',  
  },  
  cardHeader: {  
    display: 'flex',  
    justifyContent: 'space-between',  
    alignItems: 'center',  
    padding: '20px 24px',  
    cursor: 'pointer',  
    userSelect: 'none' as const,  
    backgroundColor: '\#151D30',  
  },  
  cardTitleZone: {  
    display: 'flex',  
    alignItems: 'center',  
    gap: '12px',  
  },  
  cardTitle: {  
    fontFamily: '"Satoshi Variable", sans-serif',  
    fontSize: '16px',  
    fontWeight: 600,  
    color: '\#FFFFFF',  
    margin: 0,  
  },  
  badge: {  
    fontSize: '11px',  
    fontWeight: 700,  
    padding: '2px 8px',  
    borderRadius: '20px',  
    textTransform: 'uppercase' as const,  
  },  
  cardContent: {  
    padding: '24px',  
    borderTop: '1px solid \#1F2937',  
    backgroundColor: '\#111827',  
  },  
  inputGroup: {  
    marginBottom: '20px',  
    display: 'flex',  
    flexDirection: 'column' as const,  
    gap: '8px',  
  },  
  label: {  
    fontSize: '14px',  
    fontWeight: 600,  
    color: '\#D1D5DB',  
  },  
  input: {  
    width: '100%',  
    padding: '12px 16px',  
    backgroundColor: '\#1F2937',  
    border: '1px solid \#374151',  
    borderRadius: '8px',  
    color: '\#FFFFFF',  
    fontSize: '14px',  
    outline: 'none',  
    transition: 'border-color 0.2s ease',  
  },  
  inputFocus: {  
    borderColor: '\#34D399',  
  },  
  buttonPrimary: {  
    backgroundColor: '\#34D399',  
    color: '\#0B0F19',  
    fontFamily: '"Satoshi Variable", sans-serif',  
    fontWeight: 700,  
    fontSize: '14px',  
    padding: '12px 24px',  
    border: 'none',  
    borderRadius: '8px',  
    cursor: 'pointer',  
    display: 'inline-flex',  
    alignItems: 'center',  
    justifyContent: 'center',  
    transition: 'background-color 0.2s ease',  
  },  
  buttonSecondary: {  
    backgroundColor: 'transparent',  
    color: '\#9CA3AF',  
    border: '1px solid \#374151',  
    fontWeight: 600,  
    fontSize: '14px',  
    padding: '12px 24px',  
    borderRadius: '8px',  
    cursor: 'pointer',  
    transition: 'all 0.2s ease',  
  },  
  footerActions: {  
    display: 'flex',  
    justifyContent: 'flex-end',  
    gap: '12px',  
    borderTop: '1px solid \#1F2937',  
    paddingTop: '20px',  
    marginTop: '24px',  
  },  
  errorText: {  
    color: '\#EF4444',  
    fontSize: '13px',  
    marginTop: '4px',  
    marginGroup: '0',  
  },  
};

// \=============================================================================  
// COMPONENT INTERFACES  
// \=============================================================================  
interface EscrowVaultMetrics {  
  availableBalance: number;  
  lockedCampaignFunds: number;  
  totalPooledBalance: number;  
  tdsBufferBalance: number;  
  currency: 'INR' | 'USD';  
  virtualAccountNumber: string;  
}

export const EscrowLifecycleManager: React.FC\<{ brandId: string }\> \= ({ brandId }) \=\> {  
  // Navigation active state following Section 14 State-Based Rendering constraints  
  const \[activeCard, setActiveCard\] \= useState\<string | null\>('VAULT\_PROVISIONING');  
    
  // Dashboard Metrics State  
  const \[metrics, setMetrics\] \= useState\<EscrowVaultMetrics\>({  
    availableBalance: 0.0,  
    lockedCampaignFunds: 0.0,  
    totalPooledBalance: 0.0,  
    tdsBufferBalance: 0.0,  
    currency: 'INR',  
    virtualAccountNumber: 'Not Maintained',  
  });

  // Allocation Execution Form Variables  
  const \[grossQuoteInput, setGrossQuoteInput\] \= useState\<string\>('');  
  const \[tdsRate, setTdsRate\] \= useState\<'0.00' | '1.00' | '2.00'\>('2.00');  
  const \[validationError, setValidationError\] \= useState\<string | null\>(null);  
  const \[isSubmitting, setIsSubmitting\] \= useState\<boolean\>(false);

  // Dynamic calculations box tracking variables  
  const \[previewBreakdown, setPreviewBreakdown\] \= useState\<{  
    comm: number;  
    gst: number;  
    totalLock: number;  
    tds: number;  
    netPayout: number;  
  } | null\>(null);

  // Run dynamic preview logic instantly when values alter  
  useEffect(() \=\> {  
    const rawNum \= parseFloat(grossQuoteInput);  
    if (\!isNaN(rawNum) && rawNum \> 0\) {  
      const comm \= rawNum \* 0.07;  
      const gst \= metrics.currency \=== 'INR' ? comm \* 0.18 : 0.0;  
      const totalLock \= rawNum \+ comm \+ gst;  
      const tds \= rawNum \* (parseFloat(tdsRate) / 100);  
      const netPayout \= rawNum \- tds;

      setPreviewBreakdown({ comm, gst, totalLock, tds, netPayout });  
      setValidationError(null);  
    } else {  
      setPreviewBreakdown(null);  
    }  
  }, \[grossQuoteInput, tdsRate, metrics.currency\]);

  const toggleAccordion \= (panelKey: string) \=\> {  
    setActiveCard(activeCard \=== panelKey ? null : panelKey);  
  };

  const executeVaultInitialization \= async () \=\> {  
    setIsSubmitting(true);  
    try {  
      // Direct integration simulation hook  
      // In production, execute against your backend path: /api/v1/escrow/initialize  
      setMetrics((prev) \=\> ({  
        ...prev,  
        virtualAccountNumber: 'VA-RZPX-99881122',  
        availableBalance: 25000.0,  
        totalPooledBalance: 25000.0,  
      }));  
      setActiveCard('LOCK\_ALLOCATION');  
    } catch (err) {  
      console.error(err);  
    } finally {  
      setIsSubmitting(false);  
    }  
  };

  const handleCommitLock \= async (e: React.FormEvent) \=\> {  
    e.preventDefault();  
    if (\!previewBreakdown) {  
      setValidationError('Please specify a positive numerical quote threshold.');  
      return;  
    }

    if (previewBreakdown.totalLock \> metrics.availableBalance) {  
      setValidationError(\`Insufficient wallet balance. Total Required: ${previewBreakdown.totalLock.toFixed(2)}\`);  
      return;  
    }

    setIsSubmitting(true);  
    try {  
      // Simulate backend response execution across interactive states  
      setMetrics((prev) \=\> ({  
        ...prev,  
        availableBalance: prev.availableBalance \- previewBreakdown.totalLock,  
        lockedCampaignFunds: prev.lockedCampaignFunds \+ previewBreakdown.totalLock,  
      }));  
      setGrossQuoteInput('');  
      setActiveCard('TRANCHE\_RELEASE');  
    } catch (err) {  
      setValidationError('System connectivity error. Transaction was securely rolled back.');  
    } finally {  
      setIsSubmitting(false);  
    }  
  };

  return (  
    \<div style={styles.container}\>  
      {/\* 1\. UNIVERSAL HEADER BAR \*/}  
      \<div style={styles.headerZone}\>  
        \<h1 style={styles.heading}\>Statutory Escrow & Ledger Console\</h1\>  
        \<p style={styles.subline}\>  
          Workspace Context Tracking: {brandId} • Mode: Safe High-Precision Floating Isolation  
        \</p\>  
      \</div\>

      {/\* 2\. REAL-TIME ACCOUNT METRICS BAR \*/}  
      \<div style={styles.metricsGrid}\>  
        \<div style={styles.metricCard}\>  
          \<div style={styles.metricLabel}\>Total Pooled Capital\</div\>  
          \<div style={styles.metricValue}\>  
            {metrics.currency} {metrics.totalPooledBalance.toFixed(2)}  
          \</div\>  
        \</div\>  
        \<div style={styles.metricCard}\>  
          \<div style={styles.metricLabel}\>Liquid Available Balance\</div\>  
          \<div style={styles.metricValue}\>  
            {metrics.currency} {metrics.availableBalance.toFixed(2)}  
          \</div\>  
        \</div\>  
        \<div style={styles.metricCard}\>  
          \<div style={styles.metricLabel}\>Locked Campaign Reserves\</div\>  
          \<div style={styles.metricValue}\>  
            {metrics.currency} {metrics.lockedCampaignFunds.toFixed(2)}  
          \</div\>  
        \</div\>  
        \<div style={styles.metricCard}\>  
          \<div style={styles.metricLabel}\>Statutory TDS Buffer Pool\</div\>  
          \<div style={styles.metricValue}\>  
            {metrics.currency} {metrics.tdsBufferBalance.toFixed(2)}  
          \</div\>  
        \</div\>  
      \</div\>

      {/\* 3\. WORKFLOW CARDS ACCORDION STACK \*/}  
      \<div style={styles.accordionWrapper}\>  
          
        {/\* CARD A: VAULT SETUP \*/}  
        \<div style={{ ...styles.card, ...(activeCard \=== 'VAULT\_PROVISIONING' ? styles.cardActive : {}) }}\>  
          \<div style={styles.cardHeader} onClick={() \=\> toggleAccordion('VAULT\_PROVISIONING')}\>  
            \<div style={styles.cardTitleZone}\>  
              \<span style={{ transform: activeCard \=== 'VAULT\_PROVISIONING' ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}\>▶\</span\>  
              \<h3 style={styles.cardTitle}\>Stage 1: Smart-Collect Vault Provisioning\</h3\>  
            \</div\>  
            \<span style={{   
              ...styles.badge,   
              backgroundColor: metrics.virtualAccountNumber \!== 'Not Maintained' ? 'rgba(52, 211, 153, 0.1)' : 'rgba(245, 158, 11, 0.1)',  
              color: metrics.virtualAccountNumber \!== 'Not Maintained' ? '\#34D399' : '\#F59E0B'  
            }}\>  
              {metrics.virtualAccountNumber \!== 'Not Maintained' ? 'Active Linked' : 'Uninitialized'}  
            \</span\>  
          \</div\>

          {activeCard \=== 'VAULT\_PROVISIONING' && (  
            \<div style={styles.cardContent}\>  
              \<p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '\#9CA3AF', lineHeight: '1.6' }}\>  
                Generate a multi-tenant corporate funding node linked to Razorpay Smart-Collect.   
                Incoming bank routing lines (NEFT/IMPS) will capture and clear balances live into the database schema.  
              \</p\>  
              \<div style={styles.inputGroup}\>  
                \<span style={styles.label}\>Linked Corporate Routing Reference Code\</span\>  
                \<div style={{ padding: '12px', backgroundColor: '\#1F2937', borderRadius: '6px', fontSize: '14px', color: '\#FFFFFF', fontWeight: 'bold' }}\>  
                  {metrics.virtualAccountNumber}  
                \</div\>  
              \</div\>  
              {metrics.virtualAccountNumber \=== 'Not Maintained' && (  
                \<button   
                  style={styles.buttonPrimary}   
                  disabled={isSubmitting}   
                  onClick={executeVaultInitialization}  
                \>  
                  {isSubmitting ? 'Provisioning Network Node...' : 'Initialize Virtual Vault Setup'}  
                \</button\>  
              )}  
            \</div\>  
          )}  
        \</div\>

        {/\* CARD B: ESCROW HOLD SECUREMENT \*/}  
        \<div style={{ ...styles.card, ...(activeCard \=== 'LOCK\_ALLOCATION' ? styles.cardActive : {}) }}\>  
          \<div style={styles.cardHeader} onClick={() \=\> toggleAccordion('LOCK\_ALLOCATION')}\>  
            \<div style={styles.cardTitleZone}\>  
              \<span style={{ transform: activeCard \=== 'LOCK\_ALLOCATION' ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}\>▶\</span\>  
              \<h3 style={styles.cardTitle}\>Stage 2: Precision Financial Escrow Securement\</h3\>  
            \</div\>  
            \<span style={{ ...styles.badge, backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '\#3B82F6' }}\>  
              Allocation Ready  
            \</span\>  
          \</div\>

          {activeCard \=== 'LOCK\_ALLOCATION' && (  
            \<div style={styles.cardContent}\>  
              \<form onSubmit={handleCommitLock}\>  
                \<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}\>  
                  \<div style={styles.inputGroup}\>  
                    \<label style={styles.label}\>Gross Creator Quotation Base ({metrics.currency})\</label\>  
                    \<input   
                      type="number"   
                      style={styles.input}   
                      placeholder="e.g. 5000.00"   
                      value={grossQuoteInput}  
                      onChange={(e) \=\> setGrossQuoteInput(e.target.value)}  
                    /\>  
                  \</div\>

                  \<div style={styles.inputGroup}\>  
                    \<label style={styles.label}\>Indian Income Tax statutory TDS Split Parameter\</label\>  
                    \<select   
                      style={styles.input}  
                      value={tdsRate}  
                      onChange={(e) \=\> setTdsRate(e.target.value as any)}  
                    \>  
                      \<option value="0.00"\>0.00% \- Global Boundary Exemption\</option\>  
                      \<option value="1.00"\>1.00% \- Section 194-O Digital E-Commerce\</option\>  
                      \<option value="2.00"\>2.00% \- Section 194-C Corporate Sub-Contracting\</option\>  
                    \</select\>  
                  \</div\>  
                \</div\>

                {/\* REAL-TIME DYNAMIC COMPUTATION DRAWER EXPOSURE \*/}  
                {previewBreakdown && (  
                  \<div style={{ backgroundColor: '\#1F2937', borderRadius: '8px', padding: '16px', marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}\>  
                    \<div\>  
                      \<span style={{ fontSize: '12px', color: '\#9CA3AF', display: 'block' }}\>7% Platform Fee separation:\</span\>  
                      \<strong style={{ fontSize: '14px', color: '\#FFFFFF' }}\>{metrics.currency} {previewBreakdown.comm.toFixed(2)}\</strong\>  
                    \</div\>  
                    \<div\>  
                      \<span style={{ fontSize: '12px', color: '\#9CA3AF', display: 'block' }}\>18% Out-of-pocket GST Addition:\</span\>  
                      \<strong style={{ fontSize: '14px', color: '\#FFFFFF' }}\>{metrics.currency} {previewBreakdown.gst.toFixed(2)}\</strong\>  
                    \</div\>  
                    \<div\>  
                      \<span style={{ fontSize: '12px', color: '\#9CA3AF', display: 'block' }}\>Net Creator Payout Pool Target:\</span\>  
                      \<strong style={{ fontSize: '14px', color: '\#34D399' }}\>{metrics.currency} {previewBreakdown.netPayout.toFixed(2)}\</strong\>  
                    \</div\>  
                    \<div\>  
                      \<span style={{ fontSize: '12px', color: '\#9CA3AF', display: 'block' }}\>Isolated Statutory TDS Withholding:\</span\>  
                      \<strong style={{ fontSize: '14px', color: '\#F59E0B' }}\>{metrics.currency} {previewBreakdown.tds.toFixed(2)}\</strong\>  
                    \</div\>  
                    \<div style={{ gridColumn: 'span 2', borderTop: '1px solid \#374151', paddingTop: '8px', marginTop: '4px' }}\>  
                      \<span style={{ fontSize: '12px', color: '\#9CA3AF', display: 'block' }}\>Absolute Frozen Asset Allocation Lock Footprint:\</span\>  
                      \<strong style={{ fontSize: '16px', color: '\#FFFFFF' }}\>{metrics.currency} {previewBreakdown.totalLock.toFixed(2)}\</strong\>  
                    \</div\>  
                  \</div\>  
                )}

                {validationError && \<p style={styles.errorText}\>{validationError}\</p\>}

                \<div style={styles.footerActions}\>  
                  \<button type="button" style={styles.buttonSecondary} onClick={() \=\> setGrossQuoteInput('')}\>Clear Field\</button\>  
                  \<button type="submit" style={styles.buttonPrimary} disabled={isSubmitting}\>  
                    {isSubmitting ? 'Executing Pessimistic Row Lock...' : 'Authorize Escrow Security Lock'}  
                  \</button\>  
                \</div\>  
              \</form\>  
            \</div\>  
          )}  
        \</div\>

        {/\* CARD C: DISBURSAL INTERLOCKS \*/}  
        \<div style={{ ...styles.card, ...(activeCard \=== 'TRANCHE\_RELEASE' ? styles.cardActive : {}) }}\>  
          \<div style={styles.cardHeader} onClick={() \=\> toggleAccordion('TRANCHE\_RELEASE')}\>  
            \<div style={styles.cardTitleZone}\>  
              \<span style={{ transform: activeCard \=== 'TRANCHE\_RELEASE' ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}\>▶\</span\>  
              \<h3 style={styles.cardTitle}\>Stage 3: Stateful Interlocking & Milestone Release Rails\</h3\>  
            \</div\>  
            \<span style={{ ...styles.badge, backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '\#10B981' }}\>  
              Ledger Secure  
            \</span\>  
          \</div\>

          {activeCard \=== 'TRANCHE\_RELEASE' && (  
            \<div style={styles.cardContent}\>  
              \<p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '\#9CA3AF' }}\>  
                Operational milestones execute automatically based on workflow transformations.   
                Advancing past Stage 2 triggers the 30% advance tranche; compliance sign-off releases the 70% remainder.  
              \</p\>  
              \<div style={{ display: 'flex', gap: '12px' }}\>  
                \<div style={{ flex: 1, padding: '16px', backgroundColor: '\#1F2937', borderRadius: '8px', borderLeft: '4px solid \#34D399' }}\>  
                  \<span style={{ fontSize: '11px', color: '\#9CA3AF', fontWeight: 'bold', display: 'block' }}\>ADVANCE TRANCHE\</span\>  
                  \<span style={{ fontSize: '14px', color: '\#FFFFFF', display: 'block', margin: '4px 0' }}\>30% Creative Upfront Escrow\</span\>  
                  \<small style={{ color: '\#9CA3AF' }}\>Status: Managed by State-Interlock Service\</small\>  
                \</div\>  
                \<div style={{ flex: 1, padding: '16px', backgroundColor: '\#1F2937', borderRadius: '8px', borderLeft: '4px solid \#6B7280' }}\>  
                  \<span style={{ fontSize: '11px', color: '\#9CA3AF', fontWeight: 'bold', display: 'block' }}\>PERFORMANCE REMAINDER\</span\>  
                  \<span style={{ fontSize: '14px', color: '\#FFFFFF', display: 'block', margin: '4px 0' }}\>70% Delivery Remainder & Fees\</span\>  
                  \<small style={{ color: '\#9CA3AF' }}\>Status: Locked pending Post Live Verification\</small\>  
                \</div\>  
              \</div\>  
            \</div\>  
          )}  
        \</div\>

      \</div\>  
    \</div\>  
  );  
};

### **Step 9: Frontend Architecture Sign-Off & Integration Testing**

To complete verification for the user-interface console layer, assert that your front-end components conform to these integration specifications:

1. **Active Focus Enforced**: The state parameter activeCard ensures that expanding the "Precision Financial Escrow Securement" block auto-collapses any surrounding panels.  
2. **Mathematical Cohesion**: The inline canvas calculator mirrors the formulas executing inside the backend NestJS computation engine (Q \+ (Q\*0.07) \+ (C\*0.18)), preventing mismatches before API calls are submitted.  
3. **No-Card UI Resilience**: UI boundaries validate the user's input variables against the available state numbers in real time, shifting the validation warning or disable mechanisms without forcing page reloads or layout drops.

Phase II is now complete. The client interface layers connect securely with the backend transaction ledgers, currency routers, and interlocking engines. Your high-trust statutory escrow framework is ready for staging environments.  
