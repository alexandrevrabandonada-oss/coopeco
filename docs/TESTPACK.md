# ECO Test Pack Guide

This package provides automated tools to verify the operational flow and RLS security policies of the ECO PWA.

## Prerequisites

1. **Supabase Environment**: You must have a Supabase project and the latest migrations applied (`supabase_migration.sql`).
2. **Environment Variables**: A `.env.local` file with:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (MUST NOT be committed)

## Steps to Run

### 1. Seed Data
Populates neighborhoods and baseline partners.
```bash
npm run seed:eco
```

### 2. Create Test Users
Generates three personas: Resident, Cooperator, and Operator.
```bash
node tools/eco-create-test-users.mjs
```
*Note: Credentials will be printed to the console.*

### 3. Run RLS Proof
Executes a battery of automated tests to confirm data privacy.
```bash
npm run test:rls
```

### 4. Full Execution
Runs all the above in sequence.
```bash
npm run test:pack
```

## Security Rule
> [!CAUTION]
> NEVER commit your `SUPABASE_SERVICE_ROLE_KEY`. Ensure `.env.local` is in your `.gitignore`.

## Personas & Roles
- **Resident**: Can only create requests and see their own private data.
- **Cooperator**: Can see open requests in their neighborhood, but only sees private address/phone after accepting a request.
- **Operator**: Global access for management and role promotion.
