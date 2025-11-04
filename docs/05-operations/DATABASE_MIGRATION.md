# Database Migration Guide - Multi-Organization Support

## Overview

This PR introduces multi-organization support for AI providers. Database changes have been applied using `prisma db push` during development.

**⚠️ IMPORTANT**: Before deploying to production, create a proper migration file.

## Migration Required

The schema changes include:

### New Tables
- `organization_api_keys` - Multi-org admin API keys (1:N relationship with teams)
- `login_attempts` - Security login attempt tracking

### Modified Tables

#### `cost_data`
- Added `api_version` (ENUM: 'usage_v1' | 'costs_v1')
- Added `bucket_start_time` (DateTime)
- Added `bucket_end_time` (DateTime)
- Added `line_item` (String)
- Added `currency` (String)
- Added composite unique index: `(project_id, bucket_start_time, bucket_end_time, line_item, api_version)`
- Added index on `api_version`

#### `projects`
- Added `ai_provider` (String)
- Added `ai_organization_id` (String)
- Added `ai_project_id` (String)
- Added `openai_project_id` (String, unique) - Legacy field
- Added composite unique index: `(ai_provider, ai_organization_id, ai_project_id)`
- Added indexes for cost collection queries

#### `organization_api_keys`
- Added composite unique constraint: `(team_id, provider, organization_id)`
- Added indexes on `(team_id)`, `(provider, is_active)`

## Production Deployment Steps

### Option 1: Using Prisma Migrate (Recommended)

```bash
# 1. Generate migration from current schema
npx prisma migrate dev --name multi_org_support --create-only

# 2. Review the generated SQL in prisma/migrations/

# 3. Apply to production
npx prisma migrate deploy
```

### Option 2: Manual Migration

If there is drift (as detected in dev), create manual migration:

```bash
# 1. Create migration directory
mkdir -p prisma/migrations/$(date +%Y%m%d%H%M%S)_multi_org_support

# 2. Write SQL manually based on schema changes above

# 3. Apply manually or use prisma migrate resolve
```

## Data Migration

After schema migration, existing data should be migrated:

1. **Legacy OpenAI Projects**: Projects with `openaiProjectId` will continue to work
2. **New Projects**: Use `ai_provider`, `ai_organization_id`, and `ai_project_id`
3. **Cost Data**: Existing data has `api_version` = 'usage_v1' by default

## Rollback Plan

If rollback is needed:

1. Remove new columns (safe if nullable)
2. Drop new tables (`organization_api_keys`, `login_attempts`)
3. Restore previous schema state

## Notes

- Development database uses `prisma db push` for rapid iteration
- Production requires proper migration history
- All schema changes are backward compatible
- Existing data is preserved through nullable fields and defaults
