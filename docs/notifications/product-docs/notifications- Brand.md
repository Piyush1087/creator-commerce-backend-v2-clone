# **Developer Documentation: Notification Architecture Module**

**System Integration:** Core Event Bus, Gateway WebSocket Server, Multi-Tenant Routing Engine  
**Document Classification:** Technical Architecture & Schema Specifications  
**Status:** Finalized for Production

## **1\. System Architecture & Event Pipeline**

To ensure the application remains highly performant under load, the Notification Module operates **asynchronously** decoupled from core transactional database mutations.  
\[Core Platform Service\] \---\> (Dispatches Event) \---\> \[Redis Pub/Sub Queue\]  
                                                             |  
                                                             v  
                                                  \[Notification Worker\]  
                                                             |  
                                     \+-----------------------+-----------------------+  
                                     |                       |                       |  
                                     v                       v                       v  
                           \[PostgreSQL Database\]    \[WebSocket Gateway\]     \[Transactional Email API\]  
                           (State Tracking Table)   (Real-time In-App Push) (SendGrid/Postmark Router)

1. **Event Dispatch:** A system service (e.g., EscrowService, WorkflowService) completes an action and dispatches a standardized event payload to a **Redis Pub/Sub** or **BullMQ** queue.  
2. **Worker Processing:** A dedicated background worker process consumes the event, validates recipient scoping metrics, checks aggregation windows, and writes records to the storage layer.  
3. **Multi-Channel Distribution:** The worker concurrently passes the payload to:  
   * The **PostgreSQL Database** for in-app historical logging.  
   * The **WebSocket Gateway Server** for real-time, browser-active client flashes.  
   * The **Third-Party Email Router API** (e.g., SendGrid, Postmark) using low-reputation isolated network subdomains.

## **2\. Database Schema Blueprint**

To support your multi-user account configuration rules (**Max 5 seats per Organization**), in-app read/unread states are tracked at the **individual user level**, while notifications themselves are scoped by **workspace** or **individual**.

### **Core Storage Tables (PostgreSQL)**

SQL  
\-- 1\. Master Notification Event Log  
CREATE TABLE notifications (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    workspace\_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,  
    trigger\_user\_id UUID REFERENCES users(id) ON DELETE SET NULL, \-- Null if system generated  
    event\_type VARCHAR(100) NOT NULL,                            \-- e.g., 'escrow.low\_balance'  
    urgency\_level VARCHAR(20) NOT NULL,                          \-- 'CRITICAL', 'MEDIUM', 'LOW'  
    payload JSONB NOT NULL,                                       \-- Structured dynamic entity data  
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

\-- 2\. Recipient Delivery & Read State Ledger  
CREATE TABLE notification\_recipients (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    notification\_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,  
    user\_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  
    is\_read BOOLEAN NOT NULL DEFAULT FALSE,  
    is\_emailed BOOLEAN NOT NULL DEFAULT FALSE,  
    read\_at TIMESTAMP WITH TIME ZONE,  
    UNIQUE(notification\_id, user\_id)  
);

CREATE INDEX idx\_notif\_recipients\_user\_unread ON notification\_recipients(user\_id) WHERE is\_read \= FALSE;  
CREATE INDEX idx\_notifications\_workspace ON notifications(workspace\_id);

## **3\. The Finalized Platform Activity Routing Matrix**

Every logged notification requires a structured payload object containing named parameters to enable the frontend router context hook to execute context-aware routing on-click.

| Platform Module | Trigger Event | Urgency Level | In-App Bell | Transactional Email | Deep-Link Target Router Destination |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **System & Security** | Meta OAuth Token Expired / Cleared | 🔴 CRITICAL | Yes | Yes | /settings/integrations *(Forces State 4 View)* |
| **System & Security** | Inbound Team Member Invite Pending | 🟡 MEDIUM | Yes | Yes | /settings/general *(Focuses Team Table Grid)* |
| **System & Security** | Workspace Seat Capacity Bounded (5/5) | 🟢 LOW | Yes | No | /settings/general *(Highlights Capacity Monitor)* |
| **Budget & Escrow** | Escrow Balance Drops Below Safe Cap | 🔴 CRITICAL | Yes | Yes | /settings/billing *(Launches Top-Up Drawer A)* |
| **Budget & Escrow** | Subscription Invoice Payment Failed | 🔴 CRITICAL | Yes | Yes | /settings/billing *(Mounts Dunning Interceptor)* |
| **Budget & Escrow** | Monthly Tax Invoice / Receipt Compiled | 🟢 LOW | No | Yes | /settings/billing *(Expands Card 4 Accordion List)* |
| **Pricing & Usage** | Trial Window Expiring Warning (5 Days) | 🔴 CRITICAL | Yes | Yes | /settings/billing *(Flashes Selection Grid Frame)* |
| **Pricing & Usage** | Subscription Cycle Renewed Cleanly | 🟢 LOW | Yes | Yes | /settings/billing *(Updates Plan Status Summary)* |
| **Pricing & Usage** | Usage Cap Approaching (90% Outreach Limit) | 🟡 MEDIUM | Yes | Yes | /settings/billing *(Renders Progress Overload Warn)* |
| **Campaign Planner** | AI Competitive Scan / DNA Compiles | 🟢 LOW | Yes | Yes | /planner/dashboard *(Focuses Target Identity Data)* |
| **Influencer Outreach** | Creator Accepts Strategy Invitation | 🟡 MEDIUM | Yes | No | /campaigns/\[id\]/outreach *(Filters to 'Accepted')* |
| **Influencer Outreach** | Creator Dispatches Milestone Counter-Offer | 🟡 MEDIUM | Yes | Yes | /campaigns/\[id\]/outreach/\[creator\_id\] *(Launches Negotiation)* |
| **Influencer Outreach** | Allocation Offer Expired (48hr Timeout) | 🟢 LOW | Yes | No | /campaigns/\[id\]/outreach *(Filters to 'Expired')* |
| **Collaboration Sync** | Creator Drops Asset Draft for Review | 🟡 MEDIUM | Yes | Yes | /campaigns/\[id\]/workflow/\[creator\_id\] *(Opens Asset Review)* |
| **Collaboration Sync** | Creator Post Clears Automated Check | 🟢 LOW | Yes | No | /campaigns/\[id\]/dashboard *(Flashes Global Toast)* |
| **Collaboration Sync** | **CRITICAL:** Creator Misses Submission Deadline | 🔴 CRITICAL | Yes | Yes | /campaigns/\[id\]/workflow/\[creator\_id\] *(Flags Delayed State)* |
| **Collaboration Sync** | **CRITICAL:** Brand Fails to Review Asset (\>48h) | 🔴 CRITICAL | Yes | Yes | /campaigns/\[id\]/workflow/\[creator\_id\] *(Triggers Backlog Warning)* |
| **Collaboration Sync** | Automated Compliance Failure (Missing Tag) | 🔴 CRITICAL | Yes | Yes | /campaigns/\[id\]/workflow/\[creator\_id\] *(Highlights Error Log)* |

## **4\. Aggregation & Throttling Logic (Flood Protection)**

To prevent messaging spam when high volumes of creators interact with campaigns simultaneously, workers must route incoming signals through a 15-minute aggregation buffer window.  
JavaScript  
// Pseudocode Logic for Notification Worker Aggregation Checks  
async function processNotificationEvent(event) {  
    const { workspaceId, eventType, actorName, payload } \= event;  
    const windowStart \= new Date(Date.now() \- 15 \* 60 \* 1000); // 15 Minutes window Check

    // Look for matching active notification event records inside the throttling buffer  
    const existingNotification \= await db.notifications.findFirst({  
        where: {  
            workspace\_id: workspaceId,  
            event\_type: eventType,  
            created\_at: { \_gte: windowStart }  
        }  
    });

    if (existingNotification) {  
        // Increment actor grouping count parameters within the payload metadata JSONB structure  
        const updatedPayload \= aggregatePayload(existingNotification.payload, actorName, payload);  
          
        await db.notifications.update({  
            where: { id: existingNotification.id },  
            data: { payload: updatedPayload, created\_at: new Date() } // Bump window forward  
        });  
          
        // Dispatch live WebSocket updates using aggregated payload string format  
        await pushWebSocketAlert(workspaceId, existingNotification.id, updatedPayload);  
    } else {  
        // Construct fresh pristine base log record entry   
        const newNotif \= await db.notifications.create({ data: event });  
        await provisionRecipients(newNotif.id, workspaceId);  
        await distributeChannels(newNotif);  
    }  
}

## **5\. Front-End Payload & Routing Execution**

When the UI client receives a hydration package or a client clicks on an item inside the header bell popover drawer, the payload object parameter routing mechanics must be structured using standard explicit routing variables:

### **Standardized JSON Node Representation Structure**

JSON  
{  
  "id": "notif\_8832109A",  
  "event\_type": "workflow.milestone\_overdue\_creator",  
  "urgency\_level": "CRITICAL",  
  "payload": {  
    "campaign\_id": "camp\_summer\_2026",  
    "campaign\_name": "Summer High-Impact Launch",  
    "creator\_id": "cr\_avatar\_992",  
    "creator\_handle": "@tech\_stylist",  
    "milestone\_title": "HD Reel Deliverable Draft Submission",  
    "days\_overdue": 2  
  }  
}

### **Front-End Router Click Handler Switch**

TypeScript  
// Hook framework handler interpreting the target payload path  
function handleNotificationClick(notification: NotificationEvent) {  
  const { event\_type, payload } \= notification;  
    
  switch (event\_type) {  
    case 'integration.meta\_token\_expired':  
      router.push('/settings/integrations?state=token\_error');  
      break;  
    case 'escrow.low\_balance':  
      router.push('/settings/billing?action=top\_up');  
      break;  
    case 'workflow.milestone\_overdue\_creator':  
    case 'workflow.asset\_pending\_review':  
      router.push(\`/campaigns/${payload.campaign\_id}/workflow/${payload.creator\_id}\`);  
      break;  
    case 'pricing.trial\_expiring':  
      router.push('/settings/billing?view=pricing\_matrix');  
      break;  
    default:  
      router.push('/dashboard');  
  }  
    
  // Asynchronously flag entity array item state to server endpoints as read  
  markAsRead(notification.id);  
}

