GitHub is one of the easiest services to migrate because **repositories, commits, issues, pull requests, and history are tied to your GitHub account/organization—not to your email domain**.

The only thing you're changing is the **identity** (email) associated with the account.

---

# **Scenario 1 (Most likely)**

You have:

* GitHub account owned by you  
* Login email \= `you@growthverse.in`  
* Repositories:  
  * Creator Shop  
  * Growth Verse  
  * Other projects

You want to move to:

you@thecreatorshop.in

This is a straightforward account email change.

---

# **Step 1 – Audit Your GitHub Setup**

Ask your developer to list:

* Personal GitHub account(s)  
* GitHub Organization(s)  
* Repository owners  
* Admins  
* GitHub Apps  
* Deploy Keys  
* Actions Secrets  
* Webhooks

Example:

| Item | Owner |
| ----- | ----- |
| Personal Account | `piyush` |
| Organization | `thecreatorshop` |
| Repository | `creator-shop-app` |
| Repository | `creator-shop-backend` |
| Repository | `growthverse-website` |

Don't change anything until you know who owns what.

---

# **Step 2 – Add the New Email**

In GitHub:

1. Click your profile picture.  
2. Go to **Settings**.  
3. Select **Emails**.  
4. Click **Add email address**.  
5. Add:

you@thecreatorshop.in

6. Verify the email via the message GitHub sends.

At this point:

* `growthverse.in` still works.  
* `thecreatorshop.in` is also linked.

---

# **Step 3 – Make the New Email Primary**

Back in **Settings → Emails**:

Choose:

you@thecreatorshop.in

as the **Primary email**.

This becomes:

* notification email  
* password recovery email  
* security alert email

---

# **Step 4 – Keep the Old Email Temporarily**

Do **not** immediately remove:

you@growthverse.in

Keep it for a few weeks until you've confirmed everything is working.

---

# **Step 5 – Review Repository Access**

Open every important repository.

Check:

**Settings → Collaborators & Teams**

Ensure the correct people still have access.

No changes are usually required.

---

# **Step 6 – Review GitHub Actions Secrets**

For every repository:

**Settings → Secrets and Variables**

Look for values such as:

GITHUB\_EMAIL

ADMIN\_EMAIL

NOTIFICATION\_EMAIL

If any explicitly reference `growthverse.in`, update them.

API tokens, deployment keys, and other secrets remain valid unless they embed the old email.

---

# **Step 7 – Review Deploy Keys**

Under:

**Settings → Deploy Keys**

No changes are typically required.

SSH deploy keys are tied to cryptographic keys, not email addresses.

---

# **Step 8 – Review GitHub Apps**

If you use integrations like:

* Vercel  
* Railway  
* Netlify  
* AWS CodeDeploy  
* Cloudflare  
* Slack

Check that the GitHub account still has access.

Changing the account email does not disconnect installed GitHub Apps.

---

# **Step 9 – Review Webhooks**

Repository → **Settings → Webhooks**

These usually don't depend on your email, but verify they point to the correct application URLs.

---

# **Step 10 – Review SSH Keys**

Go to:

**Settings → SSH and GPG Keys**

These are not affected by an email change.

No action is needed.

---

# **Step 11 – Review Personal Access Tokens (PATs)**

Go to:

**Settings → Developer Settings → Personal Access Tokens**

Existing tokens continue to work.

No need to regenerate them just because your email changed.

---

# **Step 12 – Review Organization Ownership**

If you have a GitHub Organization (recommended for business projects):

Confirm:

* Owners  
* Billing contact  
* Notification email

Use the new `@thecreatorshop.in` address where appropriate.

---

# **Step 13 – Check Git Commit Email**

This is the step many people overlook.

Each developer should run:

git config \--global user.email

If it returns:

developer@growthverse.in

they should update it:

git config \--global user.email "developer@thecreatorshop.in"

Then verify:

git config \--global user.name  
git config \--global user.email

Future commits will use the new email.

Note: Past commits will still show the old email in the commit history. That's normal and generally should not be rewritten unless there's a compelling reason.

---

# **Step 14 – Update Local Credential Managers (if needed)**

If developers authenticate over HTTPS with saved credentials, they may need to sign in again after the email change. If they use SSH keys, nothing usually changes.

---

# **Step 15 – Test**

Verify that you can:

* Sign in with the new email.  
* Push and pull from repositories.  
* Trigger GitHub Actions.  
* Receive notifications.  
* Access organization repositories.  
* Merge pull requests.

---

# **Migration Checklist for Your Developer**

Ask your developer to complete and confirm each of these:

* ☐ Add `@thecreatorshop.in` email to the GitHub account.  
* ☐ Verify the new email.  
* ☐ Make it the primary email.  
* ☐ Update organization billing/notification email (if applicable).  
* ☐ Audit GitHub Actions secrets for old email references.  
* ☐ Review webhooks and integrations.  
* ☐ Update local Git `user.email` on all development machines.  
* ☐ Confirm all repositories, Actions, and deployments still work.  
* ☐ Keep the `@growthverse.in` email active until all systems are verified.

### **One recommendation**

Since **Creator Shop** is becoming its own brand, if you're currently using a **personal GitHub account** to own production repositories, consider creating or using a **GitHub Organization** (for example, `thecreatorshop`) and making it the owner of all production repositories. That way, repository ownership is independent of any one person's email address, making future team changes and domain migrations much easier.

