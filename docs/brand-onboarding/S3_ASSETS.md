# Brand onboarding — S3 assets (v2)

## Buckets (public, `ap-south-1`)

| Stage | Bucket name |
|-------|-------------|
| local | `creatorshop-v2-files-local` |
| dev | `creatorshop-v2-files-dev` |
| prod | `creatorshop-v2-files-prod` |

SST (`sst.config.ts`) creates/links `files-v2` with the `creatorshop-v2-files-{stage}` name and sets `S3_BUCKET_NAME` on the API service.

For **local** Nest without SST, uncomment in `.env`:

```env
S3_BUCKET_NAME=creatorshop-v2-files-local
AWS_REGION=ap-south-1
```

Create the bucket once in AWS (public read for objects) or run `sst deploy --stage dev` to provision dev/prod buckets.

## Surface scan mirroring

After Gemini synthesis, `BrandScanAssetMirrorService` copies remote images into S3 and replaces DB-bound URLs with stable public HTTPS URLs:

- `brand-onboarding/v2/{domainSlug}/{leadId}/logo/…`
- `…/products/p01-…` (best-effort; missing product images are OK)
- `…/competitors/c01-…`

If S3 is not configured or a download fails, the scan still completes using the original scraped URL (or no image).

## API

- `GET /api/v1/s3/signed-url?key=` — presigned GET (7 days), same pattern as v1.

## Frontend

`BrandImageAvatar` shows the image when the URL loads; on missing URL or `onError`, shows the first letter of the label (brand/product/competitor name).
