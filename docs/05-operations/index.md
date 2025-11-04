# Operations Documentation

This folder contains operational guides for setup, deployment, testing, and maintenance of the FinOps for AI platform.

## Operations Workflow

```
1. Initial Setup → 2. Database Migration → 3. Integration Testing → 4. Security Validation → 5. Monitoring Setup → 6. Pilot Testing
```

---

## Documents Overview

### 1. Setup Guide ⭐
**File**: `SETUP.md` (16KB)
**Updated**: 2025-01-04
**Purpose**: Complete environment setup and Admin API Key registration

**Sections**:
1. Prerequisites (Node.js, PostgreSQL, Redis, AWS KMS)
2. Environment Variables (including `OPENAI_ADMIN_API_KEY`)
3. **Admin API Key Registration** (NEW - Costs API requirement)
   - OpenAI Dashboard key generation
   - UI-based registration
   - CLI-based registration
   - Project ID registration
4. Database Setup (Prisma migrations)
5. Verification Scripts

**Use this when**: Setting up a new environment or registering Admin API Keys

---

### 2. Database Migration Guide
**File**: `DATABASE_MIGRATION.md` (2.6KB)
**Purpose**: Schema migration procedures and best practices

**Sections**:
- Prisma migration workflow
- Schema versioning strategy
- Rollback procedures
- Data integrity checks

**Use this when**: Applying schema changes or managing database versions

---

### 3. Integration Testing Guide
**File**: `INTEGRATION_TESTING.md` (8.4KB)
**Purpose**: Testing strategy for API endpoints and service integration

**Sections**:
- tRPC integration tests
- API endpoint testing
- Service layer testing
- Database transaction testing
- Mocking strategies (Vitest best practices)

**Use this when**: Writing integration tests or validating API contracts

---

### 4. Security Validation Checklist
**File**: `security-validation.md` (13KB)
**Purpose**: Comprehensive security audit checklist

**Sections**:
- Authentication & Authorization (15 checks)
- Data Protection (12 checks)
- API Security (10 checks)
- Infrastructure Security (8 checks)
- Compliance (5 checks)

**Use this when**: Conducting security audits or preparing for production deployment

---

### 5. Monitoring Setup
**File**: `monitoring-setup.md` (5.2KB)
**Purpose**: Production monitoring and alerting configuration

**Sections**:
- Vercel Analytics setup
- Sentry error tracking
- Custom metrics (cost collection success rate)
- Log aggregation (Pino logger)
- Alert configuration

**Use this when**: Setting up production monitoring or debugging issues

---

### 6. Pilot Test Checklist
**File**: `pilot-test-checklist.md` (10KB)
**Purpose**: Production readiness checklist for pilot deployment

**Sections**:
- Pre-deployment checks (20 items)
- Deployment verification (15 items)
- Post-deployment monitoring (10 items)
- User acceptance testing (UAT)
- Rollback plan

**Use this when**: Preparing for pilot deployment or production rollout

---

## Operational Checklist

### Initial Setup (First-Time Installation)
1. [ ] Review SETUP.md prerequisites
2. [ ] Configure environment variables
3. [ ] **Register Team Admin API Key** (NEW - Costs API)
4. [ ] **Register Project OpenAI Project IDs** (NEW - Costs API)
5. [ ] Run database migrations (`bunx prisma migrate deploy`)
6. [ ] Run verification scripts
7. [ ] Test Costs API connection (`bun run scripts/test-costs-api.ts`)

### Pre-Production Deployment
1. [ ] Complete security-validation.md checklist
2. [ ] Run integration tests (`bun run test`)
3. [ ] Configure monitoring (Sentry, Vercel Analytics)
4. [ ] Review pilot-test-checklist.md
5. [ ] Prepare rollback plan

### Post-Deployment Maintenance
1. [ ] Monitor cron job execution (daily-batch)
2. [ ] Check Costs API collection success rate (target: >95%)
3. [ ] Review Sentry errors (weekly)
4. [ ] Validate data completeness (cost_data table)
5. [ ] Update documentation as needed

---

## Key Environment Variables (Costs API Migration)

### Required for Costs API
```bash
# OpenAI Organization Admin API Key (Team-level)
OPENAI_ADMIN_API_KEY=sk-admin-...  # For testing only

# AWS KMS for Admin Key encryption
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
KMS_KEY_ID=...

# Cron job authentication
CRON_SECRET=...
```

**Note**: Production Admin API Keys are managed via Team Settings UI, not environment variables.

---

## Validation Scripts

### 1. Validate OpenAI Setup
```bash
bun run scripts/validate-openai-setup.ts [team-id]
```
Checks:
- Team has active Admin API Key
- Admin Key decryption successful
- Projects have OpenAI Project IDs registered

### 2. Test Costs API Connection
```bash
bun run scripts/test-costs-api.ts <team-id>
```
Tests:
- Costs API authentication
- Project ID filtering
- Data collection and mapping

### 3. Manual Cron Trigger
```bash
curl -X GET http://localhost:3000/api/cron/daily-batch \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

---

## Quick Navigation

- **Planning Phase**: `/docs/01-planning/`
- **Design Phase**: `/docs/02-design/`
- **Implementation Phase**: `/docs/03-implementation/`
- **Migration Docs**: `/docs/04-migration/`

---

## Support & Troubleshooting

### Common Issues

**Issue**: Admin API Key decryption fails
- **Solution**: Check AWS KMS permissions and key policy

**Issue**: Costs API returns 403 Forbidden
- **Solution**: Verify Admin API Key has Organization Admin permissions

**Issue**: Project ID not found in Costs API response
- **Solution**: Verify Project ID is correct and accessible via Admin Key

### Where to Get Help
- **Setup Issues**: Review SETUP.md Section 3
- **Security Issues**: Review security-validation.md
- **Testing Issues**: Review INTEGRATION_TESTING.md
- **Migration Issues**: Review `/docs/04-migration/MIGRATION_SUMMARY.md`

---

**Last Updated**: 2025-01-04
**Costs API Migration**: Complete (Documentation)
**Next Steps**: Implementation Phase (Week 3-4)
