# Backend Deployment

This repo keeps the existing backend deployment identity from v1 to seamlessly take over routing and preserve infrastructure (like legacy S3 buckets) while replacing the compute resources:

- SST app: `creatorshop-be`
- AWS region: `ap-south-1`
- Dev profile: `creator-dev`
- Prod profile: `creator-prod`
- Dev domain: `api.dev.thecreatorshop.in`
- Prod domain: `api.thecreatorshop.in`

Deployment is intentionally not run during initial setup. When v2 is ready to take over, **stop deploying the old backend repo** for the target stage first.

The load balancer health check uses:
`/health/live`

---

## WSL Environment Setup (Recommended)

For performance, do **not** run `npm install` or deploy from the Windows `/mnt/c/` filesystem. Clone the repository directly into your WSL home directory (e.g., `~/repos/`).

1. **Install AWS CLI in WSL**:
   ```bash
   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
   unzip awscliv2.zip
   sudo ./aws/install
   ```

2. **Configure AWS Profiles**:
   ```bash
   aws configure --profile creator-dev
   aws configure --profile creator-prod
   ```

---

## Environment Variables

Before deploying, ensure your `.env` is fully populated. v2 introduces new AI integrations.
Required additions for your deployment `.env`:
```env
# Points to your standalone Dev DB (e.g., your t4g.micro instance)
DEV_DATABASE_URL=postgresql://...

# New v2 Required Keys
GEMINI_API_KEY=...
PARALLEL_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
CORS_ORIGINS=http://localhost:5173,https://dashboard.dev.thecreatorshop.in
```

---

## Deployment Workflows

### 1. Initial v1 to v2 Cutover (Clean Database)
For the very first deployment of v2, we want a clean database with the new schema, dropping all legacy v1 tables. Since we use Prisma migrations, `migrate reset` is the correct approach.

```bash
# 1. Wipe old database and apply v2 migrations fresh
npx prisma migrate reset --force

# 2. Deploy infrastructure & containers
npx sst deploy --stage dev
```
*(When cutting over to production, repeat this process using `--stage prod` and your production `DATABASE_URL`—assuming a fresh DB wipe is also desired there for the first v2 deploy).*

### 2. Subsequent Deployments
For all future deployments once v2 is live:

```bash
# 1. Apply any new migrations safely (without dropping data)
npx prisma migrate deploy

# 2. Deploy infrastructure & containers
npx sst deploy --stage dev
```

## Database Access (Tunneling)

Since the database is isolated within the VPC, use the SSM tunnel script to connect from your local machine.

### 1. Identify your Jumpbox/Bastion
If the IDs in the script change, you can find the current running instance ID using:
```bash
node scripts/get-jumpbox-id.mjs
```

### 2. Start the Tunnel
Open a dedicated terminal and run:
```powershell
# For Dev (uses Jumpbox)
.\scripts\start-db-tunnel.ps1 -Stage dev

# For Prod (uses Bastion)
.\scripts\start-db-tunnel.ps1 -Stage prod
```
The tunnel will map the remote database to **`localhost:5435`**.

### 3. Connect via Prisma or GUI
Once the tunnel is active, you can use Prisma Studio or any DB client:
```bash
$env:DATABASE_URL="postgresql://postgres:password@localhost:5435/creatorshop_be?schema=public"
npx prisma studio
```