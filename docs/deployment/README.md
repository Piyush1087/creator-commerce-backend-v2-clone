# Backend Deployment

This repo keeps the existing backend deployment identity:

- SST app: `creatorshop-be`
- AWS region: `ap-south-1`
- Dev profile: `creator-dev`
- Prod profile: `creator-prod`
- Dev domain: `api.dev.thecreatorshop.in`
- Prod domain: `api.thecreatorshop.in`

Deployment is intentionally not run during initial setup. When v2 is ready to
take over, stop deploying the old backend repo for the target stage first.

The load balancer health check uses:

```text
/health/live
```

Database migrations are manual for now. Do not add container startup migrations
until the cutover flow is reviewed.
