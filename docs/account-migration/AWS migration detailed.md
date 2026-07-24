Since you're on **Google Workspace Business Starter**, you're in a good position. You can add **thecreatorshop.in** as a secondary domain and later promote it to the primary domain without recreating your Workspace or losing Gmail, Drive, or Calendar data.

## **AWS Migration (Step-by-Step)**

The AWS migration depends on **which AWS services you're actually using**. From our previous discussions, I believe you're likely using some combination of:

* Route 53  
* EC2  
* Lambda  
* S3  
* CloudFront  
* Certificate Manager (ACM)  
* SES (possibly, although you also use Postmark)

The safest approach is to migrate in phases.

---

# **Phase 1 – Audit Everything**

Before changing anything, make an inventory.

### **1\. Route 53**

Check whether `growthverse.in` is hosted in Route 53\.

Go to:

AWS Console  
→ Route 53  
→ Hosted Zones

Look for:

growthverse.in

Record:

* NS Records  
* A Records  
* CNAME  
* MX  
* TXT  
* SPF  
* DKIM  
* DMARC

---

### **2\. Certificate Manager (ACM)**

Go to:

AWS Console  
→ Certificate Manager

Look for certificates containing:

growthverse.in

Examples:

growthverse.in  
\*.growthverse.in  
api.growthverse.in  
app.growthverse.in

Write them down.

---

### **3\. CloudFront**

Check whether any distributions use:

growthverse.in

Look at:

* Alternate Domain Names (CNAMEs)  
* SSL Certificate

---

### **4\. EC2**

Open EC2.

Determine whether your server configuration includes references to:

growthverse.in

Common places:

Nginx

Apache

.env

Docker

PM2

Node configs

---

### **5\. Lambda**

If you're using Lambda:

Search environment variables for:

growthverse.in

---

### **6\. S3**

If hosting a static site:

Check bucket names.

Examples:

growthverse.in

www.growthverse.in

Bucket names generally cannot be renamed.

---

### **7\. SES**

If you're using SES:

Check:

Verified Domains

Verified Identities

---

# **Phase 2 – Add the New Domain**

Purchase:

thecreatorshop.in

If using Route 53:

Create a Hosted Zone.

Do **not** delete the old one.

You'll now have two hosted zones:

growthverse.in

thecreatorshop.in

---

# **Phase 3 – Create New SSL Certificates**

Go to:

Certificate Manager

Request new certificates for:

thecreatorshop.in

\*.thecreatorshop.in

Validate via DNS.

Wait until ACM shows:

Issued

Do **not** delete the old certificates yet.

---

# **Phase 4 – Update CloudFront**

If CloudFront serves your website:

Edit the distribution.

Update:

Alternate Domain Names

Old:

growthverse.in  
www.growthverse.in

New:

thecreatorshop.in  
www.thecreatorshop.in

Choose the new ACM certificate.

Deploy.

---

# **Phase 5 – Update EC2**

SSH into the server.

Search everywhere for:

growthverse.in

Typical locations:

/etc/nginx/

/etc/apache2/

/var/www/

/home/

/opt/

/etc/systemd/

/app/.env

Update to:

thecreatorshop.in

Examples:

### **Nginx**

Old

server\_name growthverse.in www.growthverse.in;

New

server\_name thecreatorshop.in www.thecreatorshop.in;

---

Restart:

sudo systemctl restart nginx

---

# **Phase 6 – Update Environment Variables**

Typical values:

APP\_URL

API\_URL

NEXT\_PUBLIC\_SITE\_URL

BASE\_URL

FRONTEND\_URL

Replace:

growthverse.in

with

thecreatorshop.in

Restart the application.

---

# **Phase 7 – Update CORS**

If your backend allows:

https://growthverse.in

Add:

https://thecreatorshop.in

Keep both during migration.

---

# **Phase 8 – Update Cookies**

If cookies specify:

Domain=growthverse.in

Change to:

Domain=thecreatorshop.in

---

# **Phase 9 – Update API Gateway (if applicable)**

If using a custom domain:

api.growthverse.in

Create:

api.thecreatorshop.in

Associate:

* new ACM certificate  
* Route 53 alias record

---

# **Phase 10 – Lambda**

Update environment variables containing:

growthverse.in

Redeploy functions if needed.

---

# **Phase 11 – Route 53 DNS**

Recreate DNS records under the new hosted zone.

Examples:

A

AAAA

CNAME

TXT

MX

CAA

SPF

DKIM

DMARC

---

# **Phase 12 – Redirect the Old Domain**

Keep:

growthverse.in

Active.

Configure:

301 Permanent Redirect

to

thecreatorshop.in

This preserves SEO and ensures old links continue to work.

---

# **Phase 13 – Testing**

Verify that:

* Website loads on the new domain.  
* HTTPS certificate is valid.  
* Login works.  
* API requests succeed.  
* Emails send correctly (if applicable).  
* File uploads work.  
* Images and static assets load.  
* Webhooks are functioning.

---

# **Phase 14 – Leave the Old Domain Running**

Don't immediately delete:

* Route 53 hosted zone  
* SSL certificates  
* DNS records

Keep them for **3–6 months**. This gives users, integrations, and search engines time to transition.

---

## **Before proceeding**

It would help to know exactly which AWS services you're using. From the **AWS Console**, go to **Resource Groups → Tag Editor** or simply list the services with active resources. If you share that list (or a screenshot of your AWS Console home), I can give you a service-by-service migration plan and point out any AWS-specific settings that need special attention.

