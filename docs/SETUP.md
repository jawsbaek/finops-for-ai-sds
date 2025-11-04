# FinOps for AI - Environment Setup Guide (v2)

**Last Updated:** 2025-01-04
**Migration:** OpenAI Costs API Integration

This guide covers the setup of required environment variables and external services for the FinOps for AI platform, including the new **OpenAI Costs API** integration.

---

## Prerequisites

- Node.js 20+ (or Bun 1.2+)
- PostgreSQL database (Neon.tech recommended)
- AWS Account (for KMS encryption)
- OpenAI API Account with **Organization Admin API Key**
- Resend API Account (for email notifications)

---

## Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# Database
DATABASE_URL="postgresql://user:password@host:5432/database"

# NextAuth
NEXTAUTH_SECRET="your-secret-key-here" # Generate: openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"

# AWS KMS (for API key encryption)
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="your-aws-access-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret-key"
AWS_KMS_KEY_ID="arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012"

# Vercel Cron
CRON_SECRET="your-cron-secret-key" # Generate: openssl rand -base64 32

# Resend (Email Notifications)
RESEND_API_KEY="re_123456789"
ADMIN_EMAIL="admin@yourcompany.com"

# OpenAI Costs API (Optional - for development/testing only)
# Team-level Admin Keys are stored encrypted in the database
OPENAI_ADMIN_API_KEY="sk-admin-..." # Optional: For local testing only
```

---

## 1. AWS KMS Setup

### 1.1. Create KMS Customer Master Key (CMK)

```bash
aws kms create-key \
  --description "FinOps for AI - API Key Encryption" \
  --key-usage ENCRYPT_DECRYPT \
  --origin AWS_KMS \
  --region us-east-1
```

Save the `KeyId` from the response.

### 1.2. Create Key Alias (Optional but Recommended)

```bash
aws kms create-alias \
  --alias-name alias/finops-ai-encryption \
  --target-key-id <your-key-id>
```

### 1.3. Create IAM Policy

Create a policy named `FinOpsKMSPolicy` with the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "kms:Encrypt",
        "kms:Decrypt",
        "kms:GenerateDataKey",
        "kms:DescribeKey"
      ],
      "Resource": "arn:aws:kms:us-east-1:123456789012:key/<your-key-id>"
    }
  ]
}
```

### 1.4. Create IAM User and Attach Policy

```bash
# Create IAM user
aws iam create-user --user-name finops-ai-service

# Attach policy
aws iam attach-user-policy \
  --user-name finops-ai-service \
  --policy-arn arn:aws:iam::123456789012:policy/FinOpsKMSPolicy

# Create access key
aws iam create-access-key --user-name finops-ai-service
```

Save the `AccessKeyId` and `SecretAccessKey` from the response.

### 1.5. Test KMS Setup

```bash
# Test encryption
aws kms encrypt \
  --key-id <your-key-id> \
  --plaintext "test-string" \
  --region us-east-1
```

If successful, you'll receive a `CiphertextBlob` in the response.

---

## 2. Database Setup

### 2.1. Run Database Migrations

After setting up environment variables:

```bash
# Generate Prisma Client
bun prisma generate

# Run migrations (includes Costs API support)
bun prisma migrate deploy

# Apply Costs API migration specifically
bunx prisma migrate dev --name add_costs_api_support

# (Optional) Seed database
bun prisma db seed
```

**Migration Details:**
- Creates `OrganizationApiKey` table for team-level Admin API Keys
- Adds `openaiProjectId` field to `Project` model
- Extends `CostData` model with Costs API fields (`bucketStartTime`, `bucketEndTime`, `lineItem`, `apiVersion`)

---

## 3. OpenAI Admin API Key 등록

The system now uses **OpenAI Costs API** (`/v1/organization/costs`) which requires organization-level Admin API Keys instead of project-level keys.

### 3.1. OpenAI Dashboard에서 Admin Key 발급

1. Go to https://platform.openai.com/settings/organization/api-keys
2. Click "Create new secret key"
3. Select Key type: **Admin** (important: not service account or regular key)
4. Name it (e.g., "FinOps AI Production")
5. Copy the key (starts with `sk-admin-...` or `sk-proj-...` with admin scope)
6. Store it securely - you won't be able to see it again

**Note:** Admin keys have organization-level permissions and can access all projects within your OpenAI organization.

### 3.2. 시스템에 Admin Key 등록

You have two options to register the Admin API Key:

#### Option A: UI 사용 (권장)

1. Log in to the FinOps for AI platform
2. Navigate to **Team Settings** page
3. Find the "OpenAI Admin API Key" section
4. Paste your Admin API key in the input field
5. Click "등록" (Register)
6. System will automatically encrypt it using AWS KMS
7. Success message will show: "Admin API Key가 등록되었습니다 (ends with ...xxxx)"

#### Option B: CLI 스크립트 사용

```bash
# Register Admin Key via CLI script
bun run scripts/register-admin-key.ts <team-id> <admin-api-key>
```

**Success Criteria:**
- Key is encrypted with KMS and stored in `organization_api_keys` table
- `last4` field shows last 4 characters of the key
- `isActive` is set to `true`
- `keyType` is set to `admin`

### 3.3. Project ID 등록

After registering the team's Admin API Key, register OpenAI Project IDs for each project:

1. Go to OpenAI Dashboard → Projects → Select your project
2. Navigate to Settings → Copy the **Project ID** (format: `proj_abc123...`)
3. In FinOps for AI platform, go to **Project Settings**
4. Find the "OpenAI Project ID" section
5. Paste the Project ID
6. Click "등록" (Register)
7. System will validate that the Project ID is accessible via your team's Admin Key (takes 2-3 seconds)
8. Success message will show: "Project ID가 등록되었습니다. 내일부터 비용 데이터가 수집됩니다."

**Validation Process:**
- System checks Project ID format: `/^proj_[a-zA-Z0-9_-]+$/`
- Verifies uniqueness (Project ID not already used by another project)
- Tests access via Costs API using team's Admin Key
- Creates audit log entry

### 3.4. 검증 (Validation)

Run validation scripts to ensure setup is correct:

```bash
# 1. Validate OrganizationApiKey encryption and decryption
bun run scripts/validate-openai-setup.ts

# 2. Test Costs API connection for a specific team
bun run scripts/test-costs-api.ts <team-id>

# 3. Verify all teams have valid setup
bun run scripts/validate-openai-setup.ts --all
```

**Validation Script Output:**
```
✓ Team: Marketing Team (team_abc123)
  ✓ Admin API Key registered (ends with ...xyz1)
  ✓ Admin API Key decryption successful
  ✓ 3 projects found
  ✓ 2 projects with OpenAI Project ID
  ✓ Costs API connection successful
```

---

## 4. Resend API Setup

### 4.1. Create Account

1. Go to https://resend.com/signup
2. Create an account
3. Verify your email address

### 4.2. Add Domain (Production)

For production use, add and verify your domain:
1. Go to "Domains" in Resend dashboard
2. Click "Add Domain"
3. Follow DNS verification steps

For development, you can use the test domain (`onboarding@resend.dev`).

### 4.3. Create API Key

1. Go to "API Keys" in Resend dashboard
2. Click "Create API Key"
3. Name it (e.g., "FinOps AI Production")
4. Copy the key (starts with `re_...`)

### 4.4. Test Email Sending

```bash
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer re_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "onboarding@resend.dev",
    "to": "your-email@example.com",
    "subject": "Test Email",
    "html": "<p>Test email from FinOps AI</p>"
  }'
```

---

## 5. Vercel Cron Setup

### 5.1. Deploy to Vercel

```bash
vercel deploy
```

### 5.2. Add Environment Variables

In Vercel dashboard:
1. Go to Project Settings → Environment Variables
2. Add all variables from `.env` file
3. Make sure to set `CRON_SECRET` securely

### 5.3. Verify Cron Schedule

The cron job is defined in `vercel.json`:
- Schedule: `0 0 * * *` (daily at midnight UTC, 9am KST)
- Endpoint: `/api/cron/daily-batch`
- Now uses **Costs API v2** collector

### 5.4. Test Cron Job Manually

```bash
# Test daily batch with Costs API
curl -X GET https://your-app.vercel.app/api/cron/daily-batch \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Expected response:
```json
{
  "success": true,
  "recordsCreated": 15,
  "date": "2025-01-04",
  "duration": 2340,
  "apiVersion": "costs_v1"
}
```

---

## 6. Verification Checklist

Run these validation scripts to ensure complete setup:

### 6.1. Database and Encryption Verification

```bash
# 1. Verify OrganizationApiKey encryption/decryption
bun run scripts/validate-openai-setup.ts

# Expected output:
# ✓ Admin API Key decryption successful
# ✓ KMS encryption working correctly
```

### 6.2. Costs API Integration Test

```bash
# 2. Test Costs API connection for each team
bun run scripts/test-costs-api.ts <team-id>

# Expected output:
# ✓ Costs API response received
# ✓ Found 12 cost buckets
# ✓ Total cost: $45.67
# ✓ Unique projects: 3
```

### 6.3. Manual Daily Batch Execution

```bash
# 3. Run daily batch manually (tests full collection pipeline)
curl -X GET http://localhost:3000/api/cron/daily-batch \
  -H "Authorization: Bearer ${CRON_SECRET}"

# Check logs for:
# - Team iteration
# - Admin Key decryption
# - Costs API pagination
# - Project ID mapping
# - Database insertion
```

### 6.4. Database Verification

```bash
# 4. Verify collected data with apiVersion filter
bunx prisma studio

# In Prisma Studio:
# - Open `cost_data` table
# - Filter: api_version = 'costs_v1'
# - Verify fields: bucketStartTime, bucketEndTime, lineItem, currency
# - Check project_id mapping is correct
```

### 6.5. Complete System Checklist

- [ ] Database connection successful
- [ ] NextAuth login working
- [ ] AWS KMS encryption/decryption working
- [ ] **OrganizationApiKey table populated with Admin API Keys**
- [ ] **Projects have openaiProjectId registered**
- [ ] **Costs API test call successful**
- [ ] **CostData records with apiVersion='costs_v1' exist**
- [ ] Resend email notifications working
- [ ] Cron job manual trigger successful
- [ ] Dashboard displays cost data (after cron runs)

---

## 7. Data Migration Notes

### 7.1. Costs API vs. Usage API

The system now uses **Costs API** as the primary data source:

| Aspect | Usage API (Legacy) | Costs API (Current) |
|--------|-------------------|---------------------|
| **Authentication** | Project-level API key | Organization Admin API Key |
| **Data Granularity** | Model, tokens, detailed | Time buckets, line items, aggregated |
| **Project Filtering** | API key isolation | `project_ids[]` parameter |
| **Data Delay** | 8-24 hours | 8-24 hours |
| **API Version** | `usage_v1` | `costs_v1` |

### 7.2. Backward Compatibility

The schema supports **both APIs simultaneously**:
- Old data: `apiVersion='usage_v1'`, has `model`, `tokens`, `snapshotId`
- New data: `apiVersion='costs_v1'`, has `bucketStartTime`, `lineItem`, `currency`
- Dashboard aggregates both versions

### 7.3. Migration Path

```bash
# If you have existing Usage API data:
# 1. Keep existing data intact (apiVersion='usage_v1')
# 2. Register Admin API Keys and Project IDs
# 3. Run daily batch - new data will use apiVersion='costs_v1'
# 4. Both versions coexist in the database
# 5. Optionally deprecate Usage API collection in future
```

---

## 8. Troubleshooting

### 8.1. KMS Encryption Errors

**Error**: "KMS key not found"
- Check `AWS_KMS_KEY_ID` is correct ARN
- Verify IAM user has `kms:DescribeKey` permission

**Error**: "Access denied"
- Verify IAM policy is attached to user
- Check AWS credentials are correct

### 8.2. OpenAI Costs API Errors

**Error**: "Unauthorized (401)"
- Verify Admin API key is correct and active
- Check key type is "admin" (not regular or service account)
- Ensure key has organization-level permissions

**Error**: "No usage data found"
- OpenAI data is delayed 8-24 hours
- Check date parameter is in the past
- Verify Project ID belongs to the organization

**Error**: "Project ID not found"
- Verify Project ID format: `proj_[a-zA-Z0-9_-]+`
- Check Project ID exists in OpenAI Dashboard
- Ensure Admin Key has access to the project

**Error**: "Admin API Key not registered"
- Register Admin API Key via Team Settings first
- Verify `organizationApiKey.isActive = true`
- Check KMS decryption is working

### 8.3. Cron Job Not Running

- Verify `CRON_SECRET` matches in code and request
- Check Vercel deployment logs
- Ensure cron schedule is valid in `vercel.json`
- Verify teams have active Admin API Keys

### 8.4. Email Notifications Not Sending

**Error**: "Invalid API key"
- Verify `RESEND_API_KEY` is correct
- Check for typos or expired key

**Error**: "Domain not verified"
- Use `onboarding@resend.dev` for testing
- Verify custom domain in Resend dashboard

### 8.5. Data Collection Failures

**Error**: "No projects with OpenAI Project ID found"
- Register Project IDs via Project Settings
- Run validation script: `bun run scripts/validate-openai-setup.ts`

**Error**: "Unknown OpenAI Project ID, skipping"
- Project ID returned by Costs API not found in database
- Check project_id mapping in logs
- Verify Project was not deleted from database

---

## 9. Security Best Practices

1. **Never commit `.env` file** - It's already in `.gitignore`
2. **Rotate secrets regularly** - Especially `NEXTAUTH_SECRET` and `CRON_SECRET`
3. **Use separate AWS IAM users** - Don't use root account credentials
4. **Enable MFA on AWS** - Protect KMS key access
5. **Monitor KMS usage** - Set up CloudWatch alerts for unusual activity
6. **Restrict API key scopes** - Give minimal necessary permissions
7. **Audit Admin API Key access** - Review `audit_logs` table regularly
8. **Encrypt Admin Keys at rest** - Always use KMS envelope encryption
9. **Validate Project IDs** - Always run validation before enabling data collection
10. **Separate dev/prod keys** - Use different Admin Keys for different environments

---

## 10. Cost Estimation

**AWS KMS**:
- $1/month per CMK
- $0.03 per 10,000 requests
- Expected: ~$1.02/month (1 CMK + ~600 requests/month with Costs API)

**Resend**:
- Free tier: 3,000 emails/month
- Pro: $20/month for 50,000 emails/month

**Vercel**:
- Hobby: Free (includes cron jobs)
- Pro: $20/month/member (recommended for production)

**OpenAI Costs API**:
- Free (included in OpenAI platform)
- Rate limits: Standard organization limits

**Total Monthly Cost**: ~$2-42 depending on tier selections

---

## 11. Next Steps

After completing setup:

1. **Initial Configuration** (Day 1)
   - [ ] Register Admin API Keys for all teams
   - [ ] Register Project IDs for all active projects
   - [ ] Run validation scripts to verify setup

2. **Data Collection** (Day 2)
   - [ ] Manually trigger daily batch job
   - [ ] Verify cost data appears in database (`apiVersion='costs_v1'`)
   - [ ] Check dashboard displays new data

3. **Monitoring** (Ongoing)
   - [ ] Set up Sentry for error tracking
   - [ ] Monitor Costs API success rate
   - [ ] Review audit logs weekly
   - [ ] Compare Costs API vs. Usage API data (if both are running)

4. **Production Deployment**
   - [ ] Complete all verification steps
   - [ ] Test email notifications
   - [ ] Verify cron job runs automatically
   - [ ] Monitor first week of automated collection

---

## 12. Additional Resources

- [OpenAI Costs API Documentation](https://platform.openai.com/docs/api-reference/costs)
- [Migration Plan](./migration/costs-api-migration-plan.md)
- [Breaking Changes](./migration/BREAKING_CHANGES.md)
- [Architecture Documentation](./architecture.md)
- [Validation Scripts](../scripts/)

---

**Document Version:** 2.0
**Last Updated:** 2025-01-04
**Migration Status:** Costs API Integration Complete
