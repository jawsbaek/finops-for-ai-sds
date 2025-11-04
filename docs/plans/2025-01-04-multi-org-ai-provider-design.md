# Multi-Organization AI Provider Architecture Design

**Date:** 2025-01-04
**Status:** Approved
**Context:** OpenAI Costs API Migration - Multi-provider, Multi-organization Support
**Related:** [costs-api-migration-plan.md](../migration/costs-api-migration-plan.md)

---

## Executive Summary

This design extends the OpenAI Costs API migration to support **multiple AI providers** (OpenAI, Anthropic, AWS, Azure) and **multiple organizations per provider** at the team level. The architecture ensures:

- **Security**: KMS encryption, real-time validation, RBAC enforcement
- **Scalability**: Support for multiple providers and organizations without schema changes
- **Usability**: Synchronous validation with clear error messages
- **Flexibility**: Provider-agnostic design with provider-specific implementations

**Key Changes:**
1. `OrganizationApiKey` now supports multiple keys per team (1:N relationship)
2. Projects link to specific provider + organization via `aiProvider`, `aiOrganizationId`, `aiProjectId`
3. Real-time validation using provider APIs (OpenAI: Option A - project-scoped)
4. Cost collector processes multiple organizations per team

---

## 1. Problem Statement

### Current Limitations

The existing migration plan assumes:
- ❌ One Admin API Key per team (1:1 relationship)
- ❌ Single OpenAI organization per team
- ❌ No support for other AI providers (Anthropic, AWS, Azure)

### Real-World Requirements

Teams need:
- ✅ Multiple OpenAI organizations (e.g., Production, Development, Client A, Client B)
- ✅ Multiple AI providers (OpenAI + Anthropic + AWS)
- ✅ Clear mapping between projects and their provider/organization
- ✅ Isolated cost tracking per organization

---

## 2. Architecture Overview

### 2.1 Data Model

```
┌─────────────────────────────────────────────────────────────┐
│ Team Level                                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ OrganizationApiKey (Multiple per Team)               │   │
│  │  - teamId: string                                    │   │
│  │  - provider: "openai" | "anthropic" | "aws"         │   │
│  │  - organizationId: "org_abc" | "ws_123" | null      │   │
│  │  - encryptedKey: (KMS envelope encrypted)           │   │
│  │  - displayName: "Production OpenAI"                 │   │
│  │  - isActive: boolean                                │   │
│  │  Unique: [teamId, provider, organizationId]         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                         │
                         │ 1 Team → N Admin Keys
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Project Level                                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Project                                              │   │
│  │  - teamId: string                                   │   │
│  │  - aiProvider: "openai"                             │   │
│  │  - aiOrganizationId: "org_abc" (FK to Admin Key)   │   │
│  │  - aiProjectId: "proj_xyz" (validated via API)     │   │
│  │  Unique: [aiProvider, aiOrganizationId, aiProjectId]│   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                         │
                         │ Cost Collection
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Cost Data (per Project)                                      │
│  - Filtered by aiProvider + aiOrganizationId                │
│  - Mapped from provider's project ID → internal project ID  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Prisma Schema

```prisma
// Team-level Admin API Keys (supports multiple providers + organizations)
model OrganizationApiKey {
  id               String   @id @default(cuid())
  teamId           String   @map("team_id")  // ✅ Removed @unique - now 1:N
  provider         String   // 'openai', 'anthropic', 'aws', 'azure'
  organizationId   String?  @map("organization_id") // OpenAI: org_xxx, Anthropic: workspace_xxx

  // KMS Envelope Encryption
  encryptedKey     String   @map("encrypted_key") @db.Text
  encryptedDataKey String   @map("encrypted_data_key") @db.Text
  iv               String

  // Security and metadata
  last4     String   @db.VarChar(4)
  isActive  Boolean  @default(true) @map("is_active")
  keyType   String   @default("admin") @map("key_type")

  // Display name for UI (e.g., "Production OpenAI", "Dev Account")
  displayName String? @map("display_name")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@unique([teamId, provider, organizationId], name: "unique_team_provider_org")
  @@index([teamId])
  @@index([provider, isActive])
  @@map("organization_api_keys")
}

// Update Team relation
model Team {
  id        String   @id @default(cuid())
  name      String
  ownerId   String?  @map("owner_id")
  budget    Decimal? @db.Decimal(10, 2)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  members             TeamMember[]
  projects            Project[]
  organizationApiKeys OrganizationApiKey[] // ✅ Changed to array

  @@index([ownerId])
  @@map("teams")
}

// Update Project to associate with specific organization
model Project {
  id          String   @id @default(cuid())
  teamId      String   @map("team_id")
  name        String
  description String?

  // Provider-specific organization + project identifiers
  // OpenAI example: aiProvider = "openai", aiOrganizationId = "org_abc", aiProjectId = "proj_xyz"
  aiProvider         String?  @map("ai_provider") // 'openai', 'anthropic', etc.
  aiOrganizationId   String?  @map("ai_organization_id") // Links to OrganizationApiKey
  aiProjectId        String?  @map("ai_project_id") // Provider's project identifier

  // Legacy field (deprecated after migration)
  openaiProjectId String? @unique @map("openai_project_id")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  team       Team            @relation(fields: [teamId], references: [id], onDelete: Cascade)
  members    ProjectMember[]
  apiKeys    ApiKey[]
  costData   CostData[]
  metrics    ProjectMetrics?
  costAlerts CostAlert[]

  @@unique([aiProvider, aiOrganizationId, aiProjectId], name: "unique_provider_org_project")
  @@index([teamId])
  @@index([aiProvider, aiOrganizationId])
  @@map("projects")
}
```

---

## 3. Security Model

### 3.1 Access Control Matrix

| Operation | Required Role | Validation | Audit Log |
|-----------|--------------|------------|-----------|
| Register Admin Key | Team Owner/Admin | API key format + auto-detect org ID | ✅ Yes |
| View Admin Key Status | Any Team Member | - | ❌ No |
| Update Admin Key | Team Owner/Admin | Same as register | ✅ Yes |
| Deactivate Admin Key | Team Owner/Admin | - | ✅ Yes |
| Register Project AI Config | Project Member or Team Admin | Sync validation via provider API | ✅ Yes |
| View Project AI Config | Project Member or Team Admin | - | ❌ No |
| Update Project AI Config | Project Member or Team Admin | Same as register | ✅ Yes |

### 3.2 Validation Strategy

**Selected Approach: Option A - Project-scoped Synchronous Validation**

**Why Option A?**
1. **Immediate feedback** - Users know instantly if Project ID is valid
2. **Security alignment** - Validates Admin Key has access to that project
3. **Minimal data exposure** - Only queries what's needed
4. **Acceptable latency** - 200-500ms is reasonable for settings operations

**OpenAI Validation Implementation:**
```typescript
// Call: GET /v1/organization/projects/{project_id}/api_keys?limit=1
// Response codes:
// - 200: Project exists and Admin Key has access ✅
// - 404: Project not found in organization ❌
// - 403: Admin Key lacks access to project ❌
// - 429/500: OpenAI API error (retry or graceful degradation)
```

**Timeout Protection:**
- Max 5 seconds per validation call
- AbortSignal for clean cancellation
- User-friendly error messages

### 3.3 Encryption

- **Algorithm**: KMS Envelope Encryption (existing pattern)
- **Key Storage**: AWS KMS (or configured KMS provider)
- **Audit**: All decrypt operations logged via CloudWatch
- **Rotation**: Supported via KMS key rotation policies

---

## 4. API Design

### 4.1 Team Router - Admin Key Registration

**Endpoint:** `team.registerAdminApiKey`

**Input:**
```typescript
{
  teamId: string;
  provider: "openai" | "anthropic" | "aws" | "azure";
  apiKey: string; // Min 20 chars
  organizationId?: string; // Optional, auto-detected for OpenAI
  displayName?: string; // Max 100 chars
}
```

**Flow:**
1. Verify team membership (owner/admin only)
2. Validate API key format (provider-specific regex)
3. Auto-detect organization ID (for OpenAI, call `/v1/organizations`)
4. Check for duplicate (unique constraint on [teamId, provider, organizationId])
5. Encrypt with KMS
6. Store in `OrganizationApiKey` table
7. Create audit log

**Output:**
```typescript
{
  success: true;
  keyId: string;
  provider: string;
  organizationId: string | null;
  last4: string;
  displayName: string;
}
```

**Error Cases:**
- `FORBIDDEN`: User is not owner/admin
- `BAD_REQUEST`: Invalid API key format
- `CONFLICT`: Admin key for this provider+org already exists
- `TIMEOUT`: Organization ID detection timed out

### 4.2 Project Router - AI Provider Registration

**Endpoint:** `project.registerAIProvider`

**Input:**
```typescript
{
  projectId: string; // Internal project ID
  provider: "openai" | "anthropic" | "aws" | "azure";
  organizationId: string; // Must match existing OrganizationApiKey
  projectId: string; // Provider's project identifier (e.g., "proj_xyz")
}
```

**Flow:**
1. Verify project access (project member OR team admin)
2. Verify team has active Admin Key for [provider, organizationId]
3. Validate project ID format (provider-specific regex)
4. Check for duplicate (unique constraint on [aiProvider, aiOrganizationId, aiProjectId])
5. **Real-time validation** via provider API (Option A)
6. Update project with AI config
7. Create audit log

**Real-time Validation (OpenAI):**
```typescript
async function validateOpenAIProjectId(
  adminApiKey: string,
  projectId: string,
): Promise<{ valid: boolean; error?: string }> {
  const response = await fetch(
    `https://api.openai.com/v1/organization/projects/${projectId}/api_keys?limit=1`,
    {
      headers: { Authorization: `Bearer ${adminApiKey}` },
      signal: AbortSignal.timeout(5000),
    },
  );

  if (response.ok) return { valid: true };
  if (response.status === 404) {
    return { valid: false, error: "Project ID not found in your organization" };
  }
  if (response.status === 403) {
    return { valid: false, error: "Admin API Key does not have access to this project" };
  }

  throw new Error(`OpenAI API error (${response.status})`);
}
```

**Output:**
```typescript
{
  success: true;
  projectId: string; // Internal ID
  provider: string;
  organizationId: string;
  aiProjectId: string;
}
```

**Error Cases:**
- `FORBIDDEN`: User lacks project access
- `PRECONDITION_FAILED`: Team lacks Admin Key for this provider+org
- `BAD_REQUEST`: Invalid project ID format or validation failed
- `CONFLICT`: This provider project ID already registered to another project
- `TIMEOUT`: Validation API call timed out

---

## 5. Cost Collection Updates

### 5.1 Multi-Organization Collection

**Updated `collectDailyCostsV2` Flow:**

```typescript
1. Fetch ALL OrganizationApiKey records for team (provider = 'openai', isActive = true)
2. For each organization:
   a. Decrypt Admin API Key
   b. Fetch projects where [aiProvider, aiOrganizationId] match this key
   c. Call Costs API with project_ids filter (only this org's projects)
   d. Map provider project IDs → internal project IDs
   e. Store cost data with providerMetadata
3. Handle errors per-organization (continue if one fails)
4. Rate limit between organizations (respect API quotas)
```

**Updated Data Structure:**

```typescript
export interface CollectedCostDataV2 {
  projectId: string; // Internal project ID
  provider: string;
  service: string; // line_item value
  cost: number;
  bucketStartTime: Date;
  bucketEndTime: Date;
  lineItem: string | null;
  currency: string;
  apiVersion: "costs_v1";

  // NEW: Provider metadata for traceability
  providerMetadata?: {
    organizationId?: string | null;
    aiProjectId?: string | null;
  };

  // Optional context
  taskType?: string;
  userIntent?: string;
}
```

### 5.2 Error Isolation

**Principle**: Failure in one organization should not block others

```typescript
for (const orgApiKey of orgApiKeys) {
  try {
    // Collect costs for this org
  } catch (error) {
    logger.error({ organizationId: orgApiKey.organizationId, error },
      "Failed to collect costs for organization");
    // Continue with next organization
  }
}
```

### 5.3 Performance Considerations

**Scenario**: Team with 3 OpenAI orgs, 20 projects each

- **API Calls**: 3 orgs × 1 Costs API call = 3 sequential calls
- **Rate Limiting**: 1 second delay between orgs = +2 seconds total
- **Total Time**: ~3-5 seconds (acceptable for daily cron job)

**Optimization Strategies**:
- Cache decrypted keys per cron run (avoid repeated KMS calls)
- Use pagination for large organizations (>180 buckets)
- Monitor per-org API latency (alert if >10 seconds)

---

## 6. Migration Path

### 6.1 Database Migration

```sql
-- Phase 1: Remove unique constraint, add new columns
ALTER TABLE organization_api_keys DROP CONSTRAINT organization_api_keys_team_id_key;
ALTER TABLE organization_api_keys ADD COLUMN organization_id TEXT;
ALTER TABLE organization_api_keys ADD COLUMN display_name TEXT;

-- Phase 2: Create new unique constraint
CREATE UNIQUE INDEX unique_team_provider_org
  ON organization_api_keys(team_id, provider, organization_id);

-- Phase 3: Add project AI fields
ALTER TABLE projects ADD COLUMN ai_provider TEXT;
ALTER TABLE projects ADD COLUMN ai_organization_id TEXT;
ALTER TABLE projects ADD COLUMN ai_project_id TEXT;

-- Phase 4: Create unique constraint for projects
CREATE UNIQUE INDEX unique_provider_org_project
  ON projects(ai_provider, ai_organization_id, ai_project_id);

-- Phase 5: Create index for queries
CREATE INDEX projects_ai_provider_org_idx
  ON projects(ai_provider, ai_organization_id);

-- Phase 6: Data migration (copy existing data)
UPDATE organization_api_keys
SET organization_id = NULL
WHERE organization_id IS NULL;

UPDATE projects
SET ai_provider = 'openai',
    ai_project_id = openai_project_id
WHERE openai_project_id IS NOT NULL;

-- Phase 7: Backfill organizationId for existing keys (manual or script)
-- Use OpenAI API: GET /v1/organizations to get org_id
-- UPDATE organization_api_keys SET organization_id = 'org_xxx' WHERE ...
```

### 6.2 Backward Compatibility

**Legacy Support:**
- Keep `openaiProjectId` column (nullable)
- Cost collector checks both `aiProjectId` and `openaiProjectId`
- UI shows deprecation warning if using old column

**Rollback Plan:**
- All new columns are nullable (no breaking changes)
- Revert application code to use old columns
- Database schema can stay (forward compatible)

---

## 7. UI/UX Considerations

### 7.1 Team Settings Page

**Admin API Key Management:**
```
┌─────────────────────────────────────────────────────┐
│ OpenAI Organizations                                │
│                                                     │
│ ┌─────────────────────────────────────────────┐   │
│ │ Production OpenAI (org_abc...xyz)           │   │
│ │ Last 4: ...1234                             │   │
│ │ Status: Active                              │   │
│ │ [Update] [Deactivate]                       │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ ┌─────────────────────────────────────────────┐   │
│ │ Development OpenAI (org_def...uvw)          │   │
│ │ Last 4: ...5678                             │   │
│ │ Status: Active                              │   │
│ │ [Update] [Deactivate]                       │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ [+ Register New Organization]                      │
└─────────────────────────────────────────────────────┘
```

### 7.2 Project Settings Page

**AI Provider Configuration:**
```
┌─────────────────────────────────────────────────────┐
│ AI Provider                                         │
│                                                     │
│ Provider: [OpenAI ▼]                               │
│ Organization: [Production OpenAI (org_abc) ▼]     │
│ Project ID: [proj_xyz123________]                  │
│                                                     │
│ ℹ️  Find your OpenAI Project ID in Settings →     │
│    General → Project ID                            │
│                                                     │
│ [Validate & Save]                                  │
│                                                     │
│ Status: ✅ Connected (validated 2 hours ago)       │
└─────────────────────────────────────────────────────┘
```

**User Flow:**
1. Select provider (dropdown)
2. Select organization (filtered by available Admin Keys)
3. Enter project ID (text input with format hint)
4. Click "Validate & Save"
5. Real-time validation (loading spinner, 200-500ms)
6. Success: Show confirmation + last validated timestamp
7. Error: Show specific error message with retry option

---

## 8. Testing Strategy

### 8.1 Unit Tests

**Team Router:**
- ✅ Register Admin Key with auto-detected org ID
- ✅ Reject duplicate provider+org combination
- ✅ Reject non-owner/admin users
- ✅ Handle OpenAI API timeout gracefully

**Project Router:**
- ✅ Register AI provider with valid project ID
- ✅ Reject if team lacks Admin Key for provider+org
- ✅ Reject invalid project ID format
- ✅ Reject duplicate project ID across projects
- ✅ Handle validation API timeout

**Cost Collector:**
- ✅ Collect from multiple organizations
- ✅ Isolate errors per organization
- ✅ Map provider project IDs correctly
- ✅ Rate limit between organizations

### 8.2 Integration Tests

**End-to-End Flows:**
1. Register Admin Key → Validate org detection → Store encrypted
2. Register Project → Validate with OpenAI API → Store config
3. Run cost collection → Fetch from multiple orgs → Store costs
4. Query cost data → Filter by project → Aggregate correctly

**Error Scenarios:**
- OpenAI API returns 404 (invalid project ID)
- OpenAI API returns 403 (insufficient permissions)
- OpenAI API times out (5+ seconds)
- Admin Key decryption fails (KMS error)

---

## 9. Monitoring & Observability

### 9.1 Metrics

**Application Metrics:**
- `admin_key_registrations_total` (by provider)
- `project_validations_total` (by provider, status)
- `project_validation_duration_seconds` (by provider)
- `cost_collection_duration_seconds` (by team, organization)
- `cost_collection_errors_total` (by organization, error_type)

**OpenAI API Metrics:**
- Request count by endpoint
- Error rate by status code (404, 403, 429, 500)
- Latency percentiles (p50, p95, p99)

### 9.2 Alerts

**Critical:**
- Cost collection failure rate >50% for any team
- Admin Key decryption failures
- Validation API timeout rate >20%

**Warning:**
- Validation API latency >2 seconds (p95)
- Multiple organizations taking >10 seconds total
- OpenAI API rate limit errors (429)

### 9.3 Logging

**Structured Logs:**
```typescript
logger.info({
  teamId,
  provider,
  organizationId,
  operation: "admin_key_registered",
  userId,
  last4,
}, "Admin API key registered successfully");

logger.error({
  teamId,
  organizationId,
  projectId,
  validationError,
  httpStatus,
}, "Project ID validation failed");
```

---

## 10. Future Enhancements

### 10.1 Provider Support Roadmap

**Phase 1 (Current):**
- ✅ OpenAI (Costs API)

**Phase 2 (Q2 2025):**
- Anthropic (Usage API)
- AWS Bedrock (CloudWatch metrics)

**Phase 3 (Q3 2025):**
- Azure OpenAI (Metrics API)
- Google Vertex AI (Cloud Monitoring)

### 10.2 Advanced Features

**Multi-Region Support:**
- Track provider region per organization (e.g., us-east-1, eu-west-1)
- Filter costs by region

**Cost Allocation Tags:**
- Support provider-specific tagging (AWS tags, OpenAI metadata)
- Map tags to internal teams/projects

**Budget Alerts:**
- Per-organization budget thresholds
- Multi-org aggregate budgets at team level

**API Key Rotation:**
- Automated rotation workflows
- Zero-downtime key updates

---

## 11. Success Criteria

### 11.1 Functional Requirements

✅ Teams can register multiple Admin Keys per provider
✅ Teams can register multiple organizations per provider
✅ Projects can link to specific provider + organization
✅ Real-time validation prevents invalid project IDs
✅ Cost collection supports multiple organizations
✅ Costs are accurately mapped to projects
✅ Backward compatibility with existing data

### 11.2 Non-Functional Requirements

✅ Validation latency <5 seconds (p99)
✅ Cost collection completes within 1 minute for typical teams
✅ Zero data loss during migration
✅ Admin Keys remain encrypted at rest
✅ Audit logs capture all configuration changes

### 11.3 User Experience

✅ Clear error messages guide users to fix issues
✅ Dropdown pre-populates available organizations
✅ Validation provides immediate feedback
✅ UI scales to 10+ organizations per team

---

## 12. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| OpenAI API downtime during validation | Users cannot register projects | Medium | Graceful degradation: allow registration with warning flag, validate on first cron run |
| Admin Key lacks access to claimed project | Data collection fails silently | Medium | Real-time validation catches this during registration |
| Organization ID auto-detection fails | User cannot register Admin Key | Low | Allow manual org ID input as fallback |
| Cost collection timeout with many orgs | Incomplete cost data | Low | Per-org timeout (30s), continue on failure |
| Schema migration breaks existing queries | Application errors | Low | Thorough testing + rollback plan |

---

## 13. References

- [OpenAI Costs API Documentation](https://platform.openai.com/docs/api-reference/costs)
- [OpenAI Admin API - List Project Keys](https://platform.openai.com/docs/api-reference/projects/list-project-api-keys)
- [OpenAI Admin API - List Organization Keys](https://platform.openai.com/docs/api-reference/admin-api-keys/list)
- [Original Costs API Migration Plan](../migration/costs-api-migration-plan.md)
- [KMS Envelope Encryption Pattern](../../src/lib/services/encryption/kms-envelope.ts)

---

**Approved By:** Development Team
**Implementation Timeline:** Sprint 2025-W02 to W03 (2 weeks)
**Next Steps:** Create detailed implementation plan using `superpowers:writing-plans`
