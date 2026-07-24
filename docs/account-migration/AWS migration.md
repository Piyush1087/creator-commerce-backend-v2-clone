That makes things much simpler.

From what you've described:

* **AWS account login/email:** `...@growthverse.in`  
* **Application hosted on AWS:** `thecreatorshop.in`  
* **Goal:** Change the AWS account to use an email on `thecreatorshop.in`

Since the infrastructure is already serving **thecreatorshop.in**, **you do not need to migrate any AWS resources**. You're only changing the account's contact/login email.

## **Step 1: Ensure the new email exists**

First, create the new Google Workspace user or alias, for example:

admin@thecreatorshop.in

Verify that you can receive emails at that address.

---

## **Step 2: Sign in as the AWS root user**

Go to the AWS Management Console and choose **Root user** to sign in using your current root email (`...@growthverse.in`).

If you normally sign in with an IAM user or IAM Identity Center, you still need the **root user** to change the root account email.

---

## **Step 3: Change the root email**

In the AWS Console:

1. Click your account name (top right).  
2. Choose **Account**.  
3. In the **Account settings** section, find the **Root user email**.  
4. Click **Edit**.  
5. Enter the new `@thecreatorshop.in` email address.  
6. Complete the verification emails sent to both the old and new addresses (AWS may require one or both, depending on the flow).

After verification, the root user will sign in with the new email address.

---

## **Step 4: Update alternate contacts**

While you're on the Account page, update:

* Operations contact  
* Billing contact  
* Security contact

to use `@thecreatorshop.in` addresses if they currently point to `growthverse.in`.

---

## **Step 5: Check IAM users**

If your developers log in with IAM users (instead of the root account), no changes are required unless their usernames or email notifications also reference `growthverse.in`.

---

## **Step 6: Update AWS notifications**

Review:

* Billing alerts  
* Budget notifications  
* CloudWatch alarms  
* SNS topics  
* Trusted Advisor notifications

If any send emails to `@growthverse.in`, update them to `@thecreatorshop.in`.

---

## **Step 7: Test**

Sign out completely.

Sign back in using the **new root email** and confirm you can access the account.

---

### **Will anything break?**

**No**, changing the AWS account email does **not** affect:

* EC2 instances  
* Lambda functions  
* S3 buckets  
* Route 53 hosted zones  
* CloudFront distributions  
* ACM certificates  
* IAM users  
* API Gateway  
* RDS databases  
* DNS  
* SSL certificates

Those resources remain exactly as they are.

---

### **My recommendation**

Before changing the root email, enable **Multi-Factor Authentication (MFA)** on the root account if it isn't already enabled. Also make sure the new `@thecreatorshop.in` mailbox is fully set up and accessible, since AWS uses the root email for critical security and account recovery communications.

