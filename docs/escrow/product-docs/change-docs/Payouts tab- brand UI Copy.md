TAB MODULE: Payouts  
Accessible by clicking ‘Payouts’ in sidebar menu  
Module Header Context  
Section Title: Billing, Escrow & Compliance Hub  
Sub-headline Helper Text: Monitor corporate liquidity reserves, track high-precision multi-tenant escrow allocations, access secure funding rails, and audit statutory tax deductions.  
A. COLUMN PANEL 1: CAPITAL LIQUIDITY & SYSTEM BALANCE  
Instruction: Displays real-time capital allocation metrics. Admin and Finance roles have access to actionable transaction triggers; Campaign Manager views remain strictly read-only and scoped to assigned tracks.  
Metric Summary Card 1: Total Escrow Assets  
Label: Total Pooled Balance  
Default State Value: \[Icon: Wallet\] {{ Currency Enum }} 0.00 (Syncing with RazorpayX Node...)  
Dynamic State Logic: Instantly displays total funds cleared through the corporate banking wire system.  
Metric Summary Card 2: Frozen Campaign Commitments  
Label: Active Escrow Holds  
State Constraint Logic: Styled with an *\[Amber Light Fill\]* warning highlight to reflect active outstanding contract liabilities.  
Dynamic Array Iteration Loop: Total liabilities currently frozen for the duration of running milestones across {{ active\_campaign\_count }} live campaigns.  
Metric Summary Card 3: Free Liquid Asset Allocation  
Label: Liquid Available Balance  
Default State Value: *\[Aurora Green Text\]* {{ Currency Enum }} {{ available\_balance }}  
Instruction Description: Represents immediate spendable purchasing power. If this value drops below pending quotation thresholds, a system-level alert forces a layout update.  
Dynamic Notification Banner Logic:  
If available\_balance is inadequate for upcoming milestone phases ➡️ *\[Icon: Warning Triangle\]* Low Balance Block: You have {{ stalled\_allocations\_count }} creator locks stalled due to insufficient available funding assets. \[Button Link: Request Wallet Top-Up from Finance\]  
B. COLUMN PANEL 2: SECURE FUNDING RAILS & REPORTING LEDGER  
Instruction: Hosts operational banking parameters and the system's unified append-only audit stream. Selecting any history line item dynamically opens a granular detail overlay drawer.

1. Actionable Razorpay Funding Node Block  
2. Text Input Fields (Masked Read-Only for Campaign Managers / Fully Unlocked for Finance Admins): Secure Bank Transfer Direct Wire Credentials  
3. Dynamic Credentials Allocation Tracking Rules:  
4. Account Name ➡️ Aura Escrow Account \- {{ Brand Corporate Name }}  
5. Corporate Account Number ➡️ {{ razorpay\_virtual\_account\_number }}  
6. Bank Routing IFSC Code ➡️ {{ razorpay\_ifsc\_code }}  
7. UPI Link String ➡️ {{ razorpay\_upi\_string }}  
8. Inline Action Element: \[Button: Copy Funding Node Details\]  
9. Success Tracking State: Hover/Click updates text to ➔ \[Green Light Check\] Details Copied\!  
10. Transaction History Ledger Segmented Selectors  
11. Tab 1: All Capital Movements \[Icon: Layer Group\]  
12. Tab 2: Active Escrow Locks \[Icon: Lock\]  
13. Tab 3: Cleared Payout Disbursals \[Icon: Check Circle\]  
14. Tab 4: Invoices & Tax Corner \[Icon: Document Text\]  
15. Live History Context Grid Canvas  
16. (The data-table layouts below automatically update structural column arrays based on tab focus)  
17. When Tab 1 (All Capital Movements) is Active:  
18. System Helper Text: Chronological tracking of incoming top-ups, outgoing disbursals, asset holds, and platform adjustments.  
19. Editable Table Row Layout Preview:

"\[Date/Timestamp\] | \[Transaction ID Hash\] | \[Type: Deposit / Lock / Release / Refund\] | \[Linked Campaign/Creator Name Context\] | \[Precision Amount Metric\] | \[Status Badge Pill: Settled / Locked / Processing\]"  
Primary Focus Redirect CTA: \[Button: Slide Open Sidebar Detail Drawer\] OR \[Button Link: Jump to Campaign Performance Layout ↗\]  
When Tab 2 (Active Escrow Locks) is Active:  
System Helper Text: Highlights short-term liabilities locked in transaction pipelines until creative execution milestones pass sign-off.  
Editable Table Row Layout Preview:  
"\[Lock Tracking Code\] | \[Creator Profile Handle\] | \[Target Campaign Brief Name\] | \[Gross Base Quote\] | \[7% Platform Commission Component\] | \[18% Corporate GST Addition\] | \[2% Retained TDS Buffer Pool\] | \[Total Hold Value\]"  
Primary Focus Redirect CTA: \[Button: Milestone Phase Override Release ↗\] *(Role Constraint: Button is hidden for Campaign Managers)*  
When Tab 3 (Cleared Payout Disbursals) is Active:  
System Helper Text: Audits complete settling actions disbursed to external creator accounts via upfront tranches or performance clearings.  
Editable Table Row Layout Preview:  
"\[Disbursal ID\] | \[Recipient Creator Payee\] | \[Tranche Phase Identifier: ADVANCE\_30 / FINAL\_70\] | \[Net Settled Funds Amount\] | \[RazorpayX Clearing Reference ID\]"  
Primary Focus Redirect CTA: \[Button: Download Razorpay Clearing Receipt ↗\]  
When Tab 4 (Invoices & Tax Corner) is Active:  
Role Constraint Logic: *Completely hidden and disabled if user role profile matches Campaign Manager standard permission scopes.*  
System Helper Text: Secure accounting repository containing operational expense statements and statutory TDS deduction logs.  
Editable Document Row Layout Preview:  
"Monthly Consolidated Escrow Statement Summary ➔ \[Button: Export PDF\] \[Button: Export CSV\]"  
"Platform Service Fee Tax Input Credit Invoices ➔ \[Button: Download GST Invoice PDF\]"  
"Quarterly Statutory Withholding TDS Ledger Ledger ➔ \[Button: Access Tax Folder ↗\]"  
C. MODULE STICKY FOOTER BASELINE  
Left-Aligned Controls Array: \[Button (Ghost Text Link): Clear Ledger Search Query History Filter Scopes\]  
Right-Aligned Primary Actions Matrix:  
\[Button (Secondary Outlined): Export Current Filtered Table View to CSV\]  
\[Button (Solid Aurora Green): Authorize Fast Top-Up Allocation Request\]  
Action Engine: Automatically captures the active filter state parameters, queries the transaction database instance to isolate matching rows, bundles payload items into a data array ready for file generation or alerts the corporate clearing desk instantly.  
📲 MOBILE ADAPTABILITY COMPACT LAYER RULES  
On mobile screen viewports ≤ 768px, the multi-panel dashboard layout refactors into a stacked linear hierarchy stream:  
Metrics Summary Block: Top ledger summary cards transition into a swipeable carousel container row.  
Funding Credentials Zone: Compresses into a simple floating card component containing a single primary action button: \[ Copy Banking Wire Node Details \].  
Ledger Row Adaptation: Data tables hide transaction hashes, tax itemizations, and secondary parameters. The UI displays a compacted line items view mapping: {{ Creator/Campaign Name Name }} ➔ {{ Total Amount }} directly aligned with a compressed \[Status Badge Pill\].  
Compact Preview: Tapping anywhere on a mobile row overrides default navigation and slides an edge-to-edge menu drawer upwards from the viewport baseline, housing two primary redirect nodes: \[ Go to Campaign Layout ↗ \] and \[ View Full Financial Sidebar Details \].  
Sticky Bottom Mobile Overlay Bar: Houses a static, full-width action trigger button: \[ Request Corporate Balance Top-up \].  
