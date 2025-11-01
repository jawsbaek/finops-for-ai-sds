# FinOps for AI - Environment Setup Guide

This guide covers the setup of required environment variables and external services for the FinOps for AI platform.

## Prerequisites

- Node.js 20+ (or Bun 1.2+)
- PostgreSQL database (Neon.tech recommended)
- AWS Account (for KMS encryption)
- OpenAI API Account
- Resend API Account (for email notifications)

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
```

## AWS KMS Setup

### 1. Create KMS Customer Master Key (CMK)

```bash
aws kms create-key \
  --description "FinOps for AI - API Key Encryption" \
  --key-usage ENCRYPT_DECRYPT \
  --origin AWS_KMS \
  --region us-east-1
```

Save the `KeyId` from the response.

### 2. Create Key Alias (Optional but Recommended)

```bash
aws kms create-alias \
  --alias-name alias/finops-ai-encryption \
  --target-key-id <your-key-id>
```

### 3. Create IAM Policy

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

### 4. Create IAM User and Attach Policy

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

### 5. Test KMS Setup

```bash
# Test encryption
aws kms encrypt \
  --key-id <your-key-id> \
  --plaintext "test-string" \
  --region us-east-1
```

If successful, you'll receive a `CiphertextBlob` in the response.

## OpenAI API Setup

### 1. Get API Key

1. Go to https://platform.openai.com/api-keys
2. Click "Create new secret key"
3. Copy the key (starts with `sk-...`)
4. Store it securely - you won't be able to see it again

### 2. Verify API Access

```bash
curl https://api.openai.com/v1/usage?date=2025-01-01 \
  -H "Authorization: Bearer sk-YOUR_API_KEY"
```

### 3. Add API Key to Platform

After deployment, use the platform UI to add your OpenAI API key:
1. Navigate to "API Keys" section
2. Click "Add API Key"
3. Select "OpenAI" as provider
4. Paste your API key
5. The system will automatically encrypt it using AWS KMS

**Note**: OpenAI Usage API data is delayed by 8-24 hours. The cron job fetches data from 1-2 days ago.

## Resend API Setup

### 1. Create Account

1. Go to https://resend.com/signup
2. Create an account
3. Verify your email address

### 2. Add Domain (Production)

For production use, add and verify your domain:
1. Go to "Domains" in Resend dashboard
2. Click "Add Domain"
3. Follow DNS verification steps

For development, you can use the test domain (`onboarding@resend.dev`).

### 3. Create API Key

1. Go to "API Keys" in Resend dashboard
2. Click "Create API Key"
3. Name it (e.g., "FinOps AI Production")
4. Copy the key (starts with `re_...`)

### 4. Test Email Sending

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

## Vercel Cron Setup

### 1. Deploy to Vercel

```bash
vercel deploy
```

### 2. Add Environment Variables

In Vercel dashboard:
1. Go to Project Settings → Environment Variables
2. Add all variables from `.env` file
3. Make sure to set `CRON_SECRET` securely

### 3. Verify Cron Schedule

The cron job is defined in `vercel.json`:
- Schedule: `0 0 * * *` (daily at midnight UTC, 9am KST)
- Endpoint: `/api/cron/daily-batch`

### 4. Test Cron Job Manually

```bash
curl -X GET https://your-app.vercel.app/api/cron/daily-batch \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Expected response:
```json
{
  "success": true,
  "recordsCreated": 0,
  "date": "2025-01-01",
  "duration": 1234
}
```

## Database Migration

After setting up environment variables:

```bash
# Generate Prisma Client
bun prisma generate

# Run migrations
bun prisma migrate deploy

# (Optional) Seed database
bun prisma db seed
```

## Verification Checklist

- [ ] Database connection successful
- [ ] NextAuth login working
- [ ] AWS KMS encryption/decryption working
- [ ] OpenAI API key encrypted and stored
- [ ] Resend email notifications working
- [ ] Cron job manual trigger successful
- [ ] Dashboard displays cost data (after cron runs)

## Troubleshooting

### KMS Encryption Errors

**Error**: "KMS key not found"
- Check `AWS_KMS_KEY_ID` is correct ARN
- Verify IAM user has `kms:DescribeKey` permission

**Error**: "Access denied"
- Verify IAM policy is attached to user
- Check AWS credentials are correct

### OpenAI API Errors

**Error**: "Unauthorized (401)"
- Verify API key is correct and active
- Check for typos in Bearer token

**Error**: "No usage data found"
- OpenAI data is delayed 8-24 hours
- Check date parameter is in the past

### Cron Job Not Running

- Verify `CRON_SECRET` matches in code and request
- Check Vercel deployment logs
- Ensure cron schedule is valid in `vercel.json`

### Email Notifications Not Sending

**Error**: "Invalid API key"
- Verify `RESEND_API_KEY` is correct
- Check for typos or expired key

**Error**: "Domain not verified"
- Use `onboarding@resend.dev` for testing
- Verify custom domain in Resend dashboard

## Security Best Practices

1. **Never commit `.env` file** - It's already in `.gitignore`
2. **Rotate secrets regularly** - Especially `NEXTAUTH_SECRET` and `CRON_SECRET`
3. **Use separate AWS IAM users** - Don't use root account credentials
4. **Enable MFA on AWS** - Protect KMS key access
5. **Monitor KMS usage** - Set up CloudWatch alerts for unusual activity
6. **Restrict API key scopes** - Give minimal necessary permissions

## Cost Estimation

**AWS KMS**:
- $1/month per CMK
- $0.03 per 10,000 requests
- Expected: ~$1.01/month (1 CMK + ~300 requests/month)

**Resend**:
- Free tier: 3,000 emails/month
- Pro: $20/month for 50,000 emails/month

**Vercel**:
- Hobby: Free (includes cron jobs)
- Pro: $20/month/member (recommended for production)

**Total Monthly Cost**: ~$2-42 depending on tier selections
