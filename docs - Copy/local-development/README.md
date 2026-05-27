# Backend Local Development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create local env:

   ```bash
   cp .env.example .env
   ```

3. Start local Postgres:

   ```bash
   docker compose up -d
   ```

4. Generate Prisma client:

   ```bash
   npm run prisma:generate
   ```

5. Start the API:

   ```bash
   npm run dev
   ```

Useful endpoints:

- `GET /`
- `GET /health/live`
- `GET /health`
