# Multi-Organization E2E Testing & UI Refactoring Design

**Created:** 2025-01-04
**Status:** ✅ COMPLETED - 2025-01-04
**Related:** `2025-01-04-multi-org-implementation-plan.md` (Backend implementation - COMPLETED)

## Implementation Summary

**Completion Date:** 2025-01-04
**Branch:** feature/mulit-ai-provider
**Commits:** 5 batches (infrastructure, procedures, components, integration, docs)

All 8 batches successfully implemented:
- ✅ Batch 1: Test Infrastructure & Mocks
- ✅ Batch 2: New tRPC Procedures (delete, toggle, unlink)
- ✅ Batch 3: React Components (8 new components)
- ✅ Batch 4: UI Integration (team & project settings)
- ✅ Batch 5: E2E Test Infrastructure (helper functions)
- ✅ Batch 6-7: Skipped (existing tests don't use multi-org)
- ✅ Batch 8: Documentation & Cleanup

## Overview

This document outlines the comprehensive design for E2E testing and UI refactoring to support the multi-organization AI provider functionality. The approach prioritizes E2E test coverage first, which will act as living documentation and reveal the exact user flows needed for UI refactoring.

## Design Philosophy

**E2E Tests First Approach:**
- E2E tests act as living documentation
- Tests reveal exact user flows needed
- UI refactoring becomes more targeted
- Tests catch regressions early

**Progressive Enhancement:**
- No breaking changes to existing functionality
- Foundation first (mocks, infrastructure)
- Backend procedures before frontend components
- Tests validate each layer

**Quality Gates:**
- All tests must pass before proceeding to next batch
- Accessibility compliance (WCAG 2.1 AA)
- Performance thresholds maintained
- Type safety throughout

## Architecture Overview

### User Flows

#### Flow 1: Admin Key Registration
```
User → Team Settings → Select Provider → Enter API Key
  ↓
Auto-detect Org ID (OpenAI) OR Manual Entry
  ↓
Submit → Validate Format → Encrypt & Store
  ↓
Display in Admin Keys List → Success Toast
```

#### Flow 2: Project Provider Registration
```
User → Project Settings → Select Provider
  ↓
Select Organization (from registered admin keys)
  ↓
Enter AI Project ID → Real-time Validation
  ↓
Register → Update Project Record → Display Provider Info
```

#### Flow 3: Multi-Org Cost Collection
```
Cron Job → Fetch All Admin Keys for Team
  ↓
For Each Organization:
  - Decrypt Admin Key
  - Fetch Projects for Org
  - Call Costs API
  - Transform & Store Data
  - Error Isolation (continue if one fails)
  ↓
Dashboard Displays Costs from All Orgs
```

### Data Model

**OrganizationApiKey** (Team-level)
- `teamId` - Team this key belongs to
- `provider` - 'openai' | 'anthropic' | 'aws' | 'azure'
- `organizationId` - Provider's org identifier (nullable for OpenAI auto-detect)
- `displayName` - User-friendly name (e.g., "Production Org")
- `encryptedKey` + `encryptedDataKey` + `iv` - KMS envelope encryption
- `isActive` - Enable/disable without deletion
- Compound unique: `[teamId, provider, organizationId]`

**Project** (Extended)
- `aiProvider` - Which AI provider this project uses
- `aiOrganizationId` - Which organization within that provider
- `aiProjectId` - Provider's project identifier
- Compound unique: `[aiProvider, aiOrganizationId, aiProjectId]`

## Phase 1: Multi-Org E2E Test Suite

### Test Files Structure

```
__tests__/e2e/
├── multi-org-admin-keys.spec.ts          # Admin key CRUD
├── multi-org-provider-registration.spec.ts # Project-provider linking
├── multi-org-cost-collection.spec.ts     # End-to-end cost flow
├── multi-org-error-scenarios.spec.ts     # Edge cases & failures
└── helpers/
    └── multi-org-helpers.ts              # Reusable helper functions
```

### Test Coverage

**multi-org-admin-keys.spec.ts:**
- Register OpenAI admin key (auto-detect org ID)
- Register second OpenAI admin key for different org (manual org ID)
- Register Anthropic admin key
- Verify all keys appear in management UI
- Delete admin key
- Toggle admin key active/inactive
- Validation errors (invalid format, duplicate keys)

**multi-org-provider-registration.spec.ts:**
- Create project
- Link project to OpenAI org #1 with project ID
- Real-time validation of project ID (mocked)
- Error handling for invalid project IDs
- Update provider/org for existing project
- Unlink provider from project
- Verify project shows correct provider/org association

**multi-org-cost-collection.spec.ts:**
- Register 2 OpenAI orgs with admin keys
- Create 2 projects, link to different orgs
- Mock Costs API responses for both orgs
- Trigger cost collection (via cron helper)
- Verify costs attributed to correct projects
- Verify dashboard displays costs from all orgs
- Verify providerMetadata is stored correctly

**multi-org-error-scenarios.spec.ts:**
- Invalid API key format → error toast
- Duplicate admin key → error toast
- Invalid project ID → validation error
- Missing admin key for provider → error message
- Cost collection fails for one org → others succeed
- Orphaned project (admin key deleted) → warning state
- Network errors during validation

### Test Infrastructure Updates

**New Mocks:**
```typescript
// __tests__/e2e/mocks/multi-org.mock.ts

export function mockOpenAICostsAPI(page: Page, orgs: Array<{
  organizationId: string;
  projects: Array<{ projectId: string; cost: number }>;
}>): Promise<void>

export function mockOpenAIOrganizationAPI(page: Page, orgId: string): Promise<void>

export function mockOpenAIProjectValidation(
  page: Page,
  projectId: string,
  isValid: boolean
): Promise<void>

export function mockAnthropicValidation(
  page: Page,
  workspaceId: string,
  isValid: boolean
): Promise<void>
```

**New Helpers:**
```typescript
// __tests__/e2e/helpers/multi-org-helpers.ts

export async function registerAdminKey(
  page: Page,
  provider: 'openai' | 'anthropic' | 'aws' | 'azure',
  apiKey: string,
  orgId?: string,
  displayName?: string
): Promise<void>

export async function getAdminKeys(page: Page): Promise<Array<{
  provider: string;
  orgId: string;
  displayName: string;
  last4: string;
  isActive: boolean;
}>>

export async function deleteAdminKey(
  page: Page,
  provider: string,
  orgId: string
): Promise<void>

export async function registerAIProvider(
  page: Page,
  projectName: string,
  provider: string,
  orgId: string,
  projectId: string
): Promise<void>

export async function verifyProviderRegistration(
  page: Page,
  expectedProvider: string,
  expectedOrg: string
): Promise<void>
```

**New Page Objects:**
```typescript
// __tests__/e2e/page-objects/team-settings-page.ts
export class TeamSettingsPage extends BasePage {
  async navigate(teamId: string): Promise<void>
  async registerAdminKey(options: RegisterAdminKeyOptions): Promise<void>
  async getAdminKeys(): Promise<AdminKey[]>
  async deleteAdminKey(provider: string, orgId: string): Promise<void>
  async toggleAdminKey(provider: string, orgId: string): Promise<void>
}

// __tests__/e2e/page-objects/project-provider-page.ts
export class ProjectProviderPage extends BasePage {
  async navigate(projectId: string): Promise<void>
  async selectProvider(provider: string): Promise<void>
  async selectOrganization(orgId: string): Promise<void>
  async enterProjectId(projectId: string): Promise<void>
  async waitForValidation(): Promise<boolean>
  async submitRegistration(): Promise<void>
  async unlinkProvider(): Promise<void>
  async getCurrentProvider(): Promise<ProviderInfo | null>
}
```

## Phase 2: UI Refactoring for Multi-Org Support

### Team Settings Page (`/teams/[teamId]/settings`)

**Design Approach:** Hybrid (Registration Form + Keys List)

**Layout:**
```
┌─────────────────────────────────────────────┐
│ Team Settings                               │
│ Manage team-level AI provider configuration │
├─────────────────────────────────────────────┤
│                                             │
│ ┌─ Register Admin API Key ────────────┐    │
│ │                                      │    │
│ │ Provider: [Dropdown ▼]               │    │
│ │ API Key: [••••••••••••••••]          │    │
│ │ Organization ID: [Optional]          │    │
│ │ Display Name: [Optional]             │    │
│ │                                      │    │
│ │ [Register Admin Key]                 │    │
│ └──────────────────────────────────────┘    │
│                                             │
│ ┌─ Registered Admin Keys ──────────────┐    │
│ │                                      │    │
│ │ ┌─ OpenAI - Production Org ────────┐ │    │
│ │ │ 🔵 OpenAI                        │ │    │
│ │ │ Org: org-abc123                  │ │    │
│ │ │ Key: ••••5678                    │ │    │
│ │ │ Status: ● Active                 │ │    │
│ │ │           [Toggle] [Delete]      │ │    │
│ │ └──────────────────────────────────┘ │    │
│ │                                      │    │
│ │ ┌─ OpenAI - Development Org ───────┐ │    │
│ │ │ 🔵 OpenAI                        │ │    │
│ │ │ Org: org-def456                  │ │    │
│ │ │ Key: ••••9012                    │ │    │
│ │ │ Status: ○ Inactive               │ │    │
│ │ │           [Toggle] [Delete]      │ │    │
│ │ └──────────────────────────────────┘ │    │
│ │                                      │    │
│ │ ┌─ Anthropic - Main Workspace ─────┐ │    │
│ │ │ 🟣 Anthropic                     │ │    │
│ │ │ Workspace: ws-xyz789             │ │    │
│ │ │ Key: ••••3456                    │ │    │
│ │ │ Status: ● Active                 │ │    │
│ │ │           [Toggle] [Delete]      │ │    │
│ │ └──────────────────────────────────┘ │    │
│ └──────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

**Component Breakdown:**

1. **AdminKeyRegistrationForm**
   - Provider dropdown (OpenAI, Anthropic, AWS, Azure)
   - API Key input (password type)
   - Organization ID input (conditional: optional for OpenAI, required for others)
   - Display Name input (always optional)
   - Info banner: "For OpenAI, org ID will be auto-detected if not provided"
   - Submit button with loading state
   - Real-time format validation

2. **AdminKeyList**
   - Empty state: "No admin keys registered. Register one above to get started."
   - Card-based layout for each key
   - Sort by: provider, then displayName

3. **AdminKeyCard**
   - Provider icon + name (color-coded)
   - Organization ID
   - Display name (bold if set)
   - Last 4 characters of key
   - Active/Inactive badge
   - Action buttons: Toggle, Delete
   - Confirmation dialog for delete

**Validation Rules:**
- API Key format validation (per provider regex)
- Organization ID format validation (if provided)
- Display name max length: 100 characters
- No duplicate [provider, organizationId] combinations

### Project Settings Page (`/projects/[id]/settings`)

**New Section:** AI Provider Configuration (placed above Alert Settings)

**Layout:**
```
┌─────────────────────────────────────────────┐
│ Project Settings                            │
├─────────────────────────────────────────────┤
│                                             │
│ ┌─ AI Provider Configuration ──────────┐    │
│ │                                      │    │
│ │ [Not Configured] OR [Currently Configured]│
│ │                                      │    │
│ │ ┌─ Register AI Provider ──────────┐  │    │
│ │ │ Provider: [OpenAI ▼]            │  │    │
│ │ │ Organization: [Production Org ▼]│  │    │
│ │ │ Project ID: [proj_____________] │  │    │
│ │ │                                 │  │    │
│ │ │ ⟳ Validating...                 │  │    │
│ │ │ ✓ Project ID validated          │  │    │
│ │ │                                 │  │    │
│ │ │ [Validate & Register]           │  │    │
│ │ └─────────────────────────────────┘  │    │
│ │                                      │    │
│ │ OR (if already registered)           │    │
│ │                                      │    │
│ │ ┌─ Current Configuration ──────────┐ │    │
│ │ │ 🔵 OpenAI - Production Org       │ │    │
│ │ │ Project: proj_••••••5678         │ │    │
│ │ │ Last validated: 2 hours ago      │ │    │
│ │ │                                  │ │    │
│ │ │ [Update] [Unlink Provider]       │ │    │
│ │ └──────────────────────────────────┘ │    │
│ └──────────────────────────────────────┘    │
│                                             │
│ ┌─ Cost Alert Thresholds ──────────────┐    │
│ │ ... existing alert settings ...      │    │
│ └──────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

**Component Breakdown:**

1. **AIProviderRegistration**
   - Provider dropdown (filtered: only providers with active admin keys)
   - Organization dropdown (cascading: filtered by selected provider)
   - AI Project ID input
   - Real-time validation indicator
   - "Validate & Register" button (disabled until validation succeeds)
   - Validation states:
     - Idle: No icon
     - Validating: Spinner icon "Checking with {provider} API..."
     - Valid: Checkmark "✓ Project ID validated successfully"
     - Invalid: X icon "✗ Invalid project ID or insufficient permissions"

2. **AIProviderDisplay**
   - Provider icon + name + organization
   - AI Project ID (partially masked: `proj_••••••5678`)
   - Last validated timestamp
   - "Update" button (opens registration form pre-filled)
   - "Unlink Provider" button (with confirmation)
   - Warning if admin key was deleted: "⚠️ Admin key no longer available. Costs cannot be collected."

**Validation Flow:**
```
User enters project ID
  ↓
Debounce 500ms
  ↓
Call api.project.validateAIProjectId.useQuery()
  ↓
Backend decrypts admin key
  ↓
Call provider validation API
  ↓
Return { valid: boolean, error?: string }
  ↓
Update UI with result
```

**Error States:**
- No admin keys registered → Show info banner: "Register an admin key in Team Settings first"
- Selected provider has no active keys → Disable organization dropdown
- Validation fails → Show error message with retry button
- Network error → Show "Check your connection and try again"

### Shared Components

**ProviderBadge.tsx**
```typescript
interface ProviderBadgeProps {
  provider: 'openai' | 'anthropic' | 'aws' | 'azure';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

// Renders provider icon + name with consistent styling
// OpenAI: 🔵 blue
// Anthropic: 🟣 purple
// AWS: 🟠 orange
// Azure: 🔷 light blue
```

**ValidationIndicator.tsx**
```typescript
interface ValidationIndicatorProps {
  status: 'idle' | 'validating' | 'valid' | 'invalid';
  error?: string;
}

// Renders spinner, checkmark, or error icon with message
```

## Phase 3: Component Architecture & Data Flow

### New React Components

#### Admin Key Management (Team Settings)

**AdminKeyManager.tsx**
```typescript
export function AdminKeyManager({ teamId }: { teamId: string }) {
  const { data: adminKeys, refetch } = api.team.getAdminApiKeys.useQuery({ teamId });
  const registerMutation = api.team.registerAdminApiKey.useMutation({ onSuccess: refetch });
  const deleteMutation = api.team.deleteAdminApiKey.useMutation({ onSuccess: refetch });
  const toggleMutation = api.team.toggleAdminApiKey.useMutation({ onSuccess: refetch });

  return (
    <div className="space-y-6">
      <AdminKeyRegistrationForm onSubmit={registerMutation.mutate} />
      <AdminKeyList
        keys={adminKeys ?? []}
        onDelete={deleteMutation.mutate}
        onToggle={toggleMutation.mutate}
      />
    </div>
  );
}
```

**AdminKeyRegistrationForm.tsx**
```typescript
interface RegisterFormData {
  provider: 'openai' | 'anthropic' | 'aws' | 'azure';
  apiKey: string;
  organizationId?: string;
  displayName?: string;
}

export function AdminKeyRegistrationForm({ onSubmit }: Props) {
  const [formData, setFormData] = useState<RegisterFormData>({ ... });
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // For OpenAI without orgId: auto-detect
    if (formData.provider === 'openai' && !formData.organizationId) {
      setIsAutoDetecting(true);
      try {
        const orgId = await fetchOpenAIOrganizationId(formData.apiKey);
        onSubmit({ ...formData, organizationId: orgId });
      } catch (error) {
        toast.error('Failed to auto-detect organization ID');
      } finally {
        setIsAutoDetecting(false);
      }
    } else {
      onSubmit(formData);
    }
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

**AdminKeyCard.tsx**
```typescript
interface AdminKeyCardProps {
  adminKey: {
    provider: string;
    organizationId: string;
    displayName?: string;
    last4: string;
    isActive: boolean;
  };
  onToggle: () => void;
  onDelete: () => void;
}

export function AdminKeyCard({ adminKey, onToggle, onDelete }: Props) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <ProviderBadge provider={adminKey.provider} />
          <p>{adminKey.displayName ?? adminKey.organizationId}</p>
          <p className="text-sm text-muted-foreground">
            Key: ••••{adminKey.last4}
          </p>
          <Badge variant={adminKey.isActive ? 'success' : 'secondary'}>
            {adminKey.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onToggle}>
            {adminKey.isActive ? 'Deactivate' : 'Activate'}
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
```

#### AI Provider Registration (Project Settings)

**AIProviderRegistration.tsx**
```typescript
export function AIProviderRegistration({ projectId, teamId }: Props) {
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [projectIdInput, setProjectIdInput] = useState<string>('');

  const { data: adminKeys } = api.team.getAdminApiKeys.useQuery({ teamId });

  // Real-time validation (debounced)
  const { data: validation, isLoading: isValidating } =
    api.project.validateAIProjectId.useQuery(
      {
        provider: selectedProvider,
        organizationId: selectedOrg,
        aiProjectId: projectIdInput,
      },
      {
        enabled: projectIdInput.length > 5,
        refetchOnWindowFocus: false,
      }
    );

  const registerMutation = api.project.registerAIProvider.useMutation({
    onSuccess: () => {
      toast.success('Provider registered successfully');
    },
  });

  const providers = [...new Set(adminKeys?.map(k => k.provider) ?? [])];
  const organizations = adminKeys?.filter(k => k.provider === selectedProvider) ?? [];

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <Select value={selectedProvider} onValueChange={setSelectedProvider}>
          {providers.map(p => <SelectItem value={p}>{p}</SelectItem>)}
        </Select>

        <Select value={selectedOrg} onValueChange={setSelectedOrg}>
          {organizations.map(org => (
            <SelectItem value={org.organizationId}>
              {org.displayName ?? org.organizationId}
            </SelectItem>
          ))}
        </Select>

        <Input
          value={projectIdInput}
          onChange={(e) => setProjectIdInput(e.target.value)}
          placeholder="proj_..."
        />

        <ValidationIndicator
          status={isValidating ? 'validating' : validation?.valid ? 'valid' : 'invalid'}
          error={validation?.error}
        />

        <Button
          type="submit"
          disabled={!validation?.valid || registerMutation.isPending}
        >
          Validate & Register
        </Button>
      </form>
    </Card>
  );
}
```

**AIProviderDisplay.tsx**
```typescript
interface ProviderInfo {
  provider: string;
  organizationId: string;
  aiProjectId: string;
  lastValidated?: Date;
}

export function AIProviderDisplay({ provider, onUpdate, onUnlink }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <ProviderBadge provider={provider.provider} showLabel />
          <p>Project: {maskProjectId(provider.aiProjectId)}</p>
          {provider.lastValidated && (
            <p className="text-sm text-muted-foreground">
              Last validated: {formatRelative(provider.lastValidated)}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onUpdate}>Update</Button>
          <Button variant="destructive" onClick={() => setShowConfirm(true)}>
            Unlink
          </Button>
        </div>
      </div>

      {showConfirm && (
        <AlertDialog>
          <AlertDialogContent>
            <AlertDialogTitle>Unlink AI Provider?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the provider association. Cost collection will stop for this project.
            </AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowConfirm(false)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onUnlink}>Unlink</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </Card>
  );
}

function maskProjectId(projectId: string): string {
  if (projectId.length <= 10) return projectId;
  const prefix = projectId.slice(0, 6);
  const suffix = projectId.slice(-4);
  return `${prefix}••••••${suffix}`;
}
```

### New tRPC Procedures

#### Team Router Extensions

**deleteAdminApiKey**
```typescript
deleteAdminApiKey: protectedProcedure
  .input(z.object({
    teamId: z.string(),
    provider: z.enum(['openai', 'anthropic', 'aws', 'azure']),
    organizationId: z.string(),
  }))
  .mutation(async ({ ctx, input }) => {
    // 1. Verify user is team member
    await verifyTeamMembership(ctx.db, input.teamId, ctx.session.user.id);

    // 2. Find the admin key
    const adminKey = await ctx.db.organizationApiKey.findUnique({
      where: {
        unique_team_provider_org: {
          teamId: input.teamId,
          provider: input.provider,
          organizationId: input.organizationId,
        },
      },
    });

    if (!adminKey) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Admin key not found' });
    }

    // 3. Check if any projects are using this org
    const projectCount = await ctx.db.project.count({
      where: {
        teamId: input.teamId,
        aiProvider: input.provider,
        aiOrganizationId: input.organizationId,
      },
    });

    if (projectCount > 0) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `Cannot delete: ${projectCount} project(s) are using this organization`,
      });
    }

    // 4. Delete the key
    await ctx.db.organizationApiKey.delete({
      where: { id: adminKey.id },
    });

    // 5. Audit log
    await ctx.db.auditLog.create({
      data: {
        action: 'admin_key_deleted',
        userId: ctx.session.user.id,
        teamId: input.teamId,
        metadata: {
          provider: input.provider,
          organizationId: input.organizationId,
        },
      },
    });

    return { success: true };
  }),
```

**toggleAdminApiKey**
```typescript
toggleAdminApiKey: protectedProcedure
  .input(z.object({
    teamId: z.string(),
    provider: z.enum(['openai', 'anthropic', 'aws', 'azure']),
    organizationId: z.string(),
    isActive: z.boolean(),
  }))
  .mutation(async ({ ctx, input }) => {
    // 1. Verify user is team member
    await verifyTeamMembership(ctx.db, input.teamId, ctx.session.user.id);

    // 2. Update the key
    const updated = await ctx.db.organizationApiKey.updateMany({
      where: {
        teamId: input.teamId,
        provider: input.provider,
        organizationId: input.organizationId,
      },
      data: {
        isActive: input.isActive,
      },
    });

    if (updated.count === 0) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Admin key not found' });
    }

    // 3. Audit log
    await ctx.db.auditLog.create({
      data: {
        action: 'admin_key_toggled',
        userId: ctx.session.user.id,
        teamId: input.teamId,
        metadata: {
          provider: input.provider,
          organizationId: input.organizationId,
          isActive: input.isActive,
        },
      },
    });

    return { success: true, isActive: input.isActive };
  }),
```

#### Project Router Extensions

**validateAIProjectId** (Query - for real-time validation)
```typescript
validateAIProjectId: protectedProcedure
  .input(z.object({
    provider: z.enum(['openai', 'anthropic', 'aws', 'azure']),
    organizationId: z.string(),
    aiProjectId: z.string(),
  }))
  .query(async ({ ctx, input }) => {
    // 1. Format validation first
    const isValidFormat = validateProviderProjectIdFormat(
      input.provider,
      input.aiProjectId
    );

    if (!isValidFormat) {
      return { valid: false, error: 'Invalid project ID format' };
    }

    // 2. Find team's admin key for this provider+org
    // Note: We need teamId - should be passed in input or derived from context
    const adminKey = await ctx.db.organizationApiKey.findFirst({
      where: {
        provider: input.provider,
        organizationId: input.organizationId,
        isActive: true,
        // TODO: Add teamId filter - need to pass in input
      },
    });

    if (!adminKey) {
      return { valid: false, error: 'No active admin key found for this organization' };
    }

    // 3. Decrypt key
    const decryptedKey = await getKMSEncryption().decrypt(
      adminKey.encryptedKey,
      adminKey.encryptedDataKey,
      adminKey.iv
    );

    // 4. Real-time validation with provider API
    try {
      const result = await validateProviderProjectId(
        input.provider,
        decryptedKey,
        input.aiProjectId
      );

      return result; // { valid: boolean, error?: string }
    } catch (error) {
      logger.error({ error, provider: input.provider }, 'Project validation failed');
      return { valid: false, error: 'Validation request failed. Please try again.' };
    }
  }),
```

**unlinkAIProvider**
```typescript
unlinkAIProvider: protectedProcedure
  .input(z.object({
    projectId: z.string(),
  }))
  .mutation(async ({ ctx, input }) => {
    // 1. Verify project access
    const project = await ctx.db.project.findUnique({
      where: { id: input.projectId },
      include: { team: { include: { members: true } } },
    });

    if (!project) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
    }

    const isMember = project.team.members.some(
      (m) => m.userId === ctx.session.user.id
    );

    if (!isMember) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
    }

    // 2. Clear provider fields
    const updated = await ctx.db.project.update({
      where: { id: input.projectId },
      data: {
        aiProvider: null,
        aiOrganizationId: null,
        aiProjectId: null,
      },
    });

    // 3. Audit log
    await ctx.db.auditLog.create({
      data: {
        action: 'ai_provider_unlinked',
        userId: ctx.session.user.id,
        projectId: input.projectId,
        metadata: {
          previousProvider: project.aiProvider,
          previousOrgId: project.aiOrganizationId,
        },
      },
    });

    return { success: true };
  }),
```

## Implementation Plan

### Batch 1: Test Infrastructure & Mocks

**Goal:** Foundation for E2E testing without touching production code

**Tasks:**
1. Create `__tests__/e2e/mocks/multi-org.mock.ts`
   - `mockOpenAICostsAPI()` - Returns costs for multiple orgs
   - `mockOpenAIOrganizationAPI()` - Auto-detect org ID
   - `mockOpenAIProjectValidation()` - Validate project IDs
   - `mockAnthropicValidation()` - Anthropic project validation

2. Create `__tests__/e2e/helpers/multi-org-helpers.ts`
   - `registerAdminKey(page, provider, apiKey, orgId?, displayName?)`
   - `getAdminKeys(page)` - Returns list of registered keys
   - `deleteAdminKey(page, provider, orgId)`
   - `registerAIProvider(page, projectName, provider, orgId, projectId)`
   - `verifyProviderRegistration(page, expectedProvider, expectedOrg)`

3. Create `__tests__/e2e/page-objects/team-settings-page.ts`
   - `navigate(teamId)` - Navigate to team settings
   - `registerAdminKey(options)` - Fill and submit registration form
   - `getAdminKeys()` - Scrape list of admin keys from UI
   - `deleteAdminKey(provider, orgId)` - Click delete and confirm
   - `toggleAdminKey(provider, orgId)` - Toggle active/inactive

4. Create `__tests__/e2e/page-objects/project-provider-page.ts`
   - `navigate(projectId)` - Navigate to project settings
   - `selectProvider(provider)` - Select from dropdown
   - `selectOrganization(orgId)` - Select from cascading dropdown
   - `enterProjectId(projectId)` - Type into input
   - `waitForValidation()` - Wait for validation indicator
   - `submitRegistration()` - Click register button
   - `unlinkProvider()` - Click unlink and confirm
   - `getCurrentProvider()` - Scrape current provider info

**Acceptance Criteria:**
- All mock functions return realistic data structures matching OpenAI/Anthropic APIs
- Helper functions handle page interactions with proper waits
- Page objects follow existing POM patterns (extend BasePage)
- No actual API calls during test execution
- All code has TypeScript types

**Verification:**
```bash
# No tests run yet, just verify types compile
bun run typecheck
```

---

### Batch 2: New tRPC Procedures (Backend)

**Goal:** Backend API endpoints for multi-org UI

**Tasks:**
1. Add to `src/server/api/routers/team.ts`:
   - `deleteAdminApiKey` mutation
   - `toggleAdminApiKey` mutation
   - Verify `getAdminApiKeys` query exists and returns all fields needed

2. Add to `src/server/api/routers/project.ts`:
   - `validateAIProjectId` query (for real-time validation)
   - `unlinkAIProvider` mutation
   - Update `registerAIProvider` if needed (should already exist from previous implementation)

3. Create unit tests:
   - `src/server/api/routers/__tests__/team-multi-org.test.ts`
     - Test deleteAdminApiKey (success, not found, has dependent projects)
     - Test toggleAdminApiKey (success, not found)
     - Test getAdminApiKeys returns correct data
   - `src/server/api/routers/__tests__/project-provider.test.ts`
     - Test validateAIProjectId (valid format, invalid format, API validation)
     - Test unlinkAIProvider (success, not found, access denied)

**Acceptance Criteria:**
- All procedures have proper input validation (zod schemas)
- Authorization checks (user must be team member)
- Audit logs created for all mutations
- Error handling with proper TRPCError codes
- Unit tests achieve >80% coverage
- Type-safe end-to-end (input/output types)

**Verification:**
```bash
bun run test -- team-multi-org.test.ts
bun run test -- project-provider.test.ts
bun run typecheck
```

---

### Batch 3: React Components (Frontend)

**Goal:** Reusable components for multi-org UI

**Tasks:**
1. Create `src/app/_components/admin-keys/` directory:
   - `AdminKeyManager.tsx` - Main container component
   - `AdminKeyRegistrationForm.tsx` - Registration form
   - `AdminKeyCard.tsx` - Individual key display
   - `AdminKeyList.tsx` - List of admin keys with empty state

2. Create `src/app/_components/ai-provider/` directory:
   - `AIProviderRegistration.tsx` - Registration form with real-time validation
   - `AIProviderDisplay.tsx` - Current provider info display
   - `ProviderBadge.tsx` - Reusable provider icon + name component
   - `ValidationIndicator.tsx` - Validation status indicator

3. Create TypeScript types:
   - `src/types/admin-keys.ts` - Admin key types
   - `src/types/ai-provider.ts` - AI provider types

4. Create component tests:
   - `src/app/_components/admin-keys/__tests__/AdminKeyManager.test.tsx`
   - `src/app/_components/admin-keys/__tests__/AdminKeyRegistrationForm.test.tsx`
   - `src/app/_components/ai-provider/__tests__/AIProviderRegistration.test.tsx`
   - Test user interactions, loading states, error states

**Acceptance Criteria:**
- Components use shadcn/ui library consistently
- Proper loading/error states with skeletons
- Toast notifications for user feedback (using sonner)
- Responsive design (mobile + desktop breakpoints)
- Accessible (ARIA labels, keyboard navigation, focus management)
- Component tests pass
- Storybook stories (optional but recommended)

**Verification:**
```bash
bun run test -- admin-keys
bun run test -- ai-provider
bun run typecheck
bun run build # Ensure no build errors
```

---

### Batch 4: UI Integration (Pages)

**Goal:** Integrate new components into existing pages

**Tasks:**
1. Refactor `src/app/(dashboard)/teams/[teamId]/settings/page.tsx`:
   - Replace existing single-key form with `<AdminKeyManager teamId={teamId} />`
   - Update page layout and spacing
   - Add `data-testid` attributes for E2E tests:
     - `data-testid="admin-key-form"`
     - `data-testid="admin-key-list"`
     - `data-testid="admin-key-card-{provider}-{orgId}"`
   - Handle empty states gracefully

2. Extend `src/app/(dashboard)/projects/[id]/settings/page.tsx`:
   - Add new section "AI Provider Configuration" before alert settings
   - Add `<Separator />` between sections
   - Integrate `<AIProviderRegistration>` or `<AIProviderDisplay>` conditionally
   - Add `data-testid` attributes:
     - `data-testid="ai-provider-section"`
     - `data-testid="ai-provider-form"`
     - `data-testid="ai-provider-display"`
   - Maintain existing alert settings functionality

3. Test manually in dev environment:
   - Navigate to team settings
   - Register admin key
   - Navigate to project settings
   - Register AI provider
   - Verify all interactions work

**Acceptance Criteria:**
- Pages render correctly with new components
- No layout shifts or visual regressions
- Existing functionality (alerts) still works
- `data-testid` attributes match E2E test expectations
- Mobile responsive
- Loading states show skeletons
- Error states show error messages

**Verification:**
```bash
bun run dev
# Manual testing:
# 1. /teams/[id]/settings - register admin keys
# 2. /projects/[id]/settings - register AI provider
# 3. Check network tab for correct API calls
# 4. Check console for errors

bun run build # Ensure production build works
```

---

### Batch 5: E2E Tests - Happy Paths

**Goal:** Core E2E test coverage for multi-org functionality

**Tasks:**
1. Create `__tests__/e2e/multi-org-admin-keys.spec.ts`:
   - Test: Register OpenAI admin key (auto-detect org)
   - Test: Register second OpenAI key (different org, manual entry)
   - Test: Register Anthropic key
   - Test: Verify all 3 keys appear in list
   - Test: Toggle key active/inactive
   - Test: Delete one key, verify removed from list

2. Create `__tests__/e2e/multi-org-provider-registration.spec.ts`:
   - Test: Create project
   - Test: Register AI provider (OpenAI org #1)
   - Test: Verify provider info displays correctly
   - Test: Update to different org
   - Test: Unlink provider, verify cleared

3. Create `__tests__/e2e/multi-org-cost-collection.spec.ts`:
   - Test: Register 2 OpenAI orgs with admin keys
   - Test: Create 2 projects, link each to different org
   - Test: Mock cost data for both orgs
   - Test: Trigger cost collection (via cron helper)
   - Test: Verify costs attributed to correct projects
   - Test: Verify dashboard displays costs from both orgs
   - Test: Verify providerMetadata stored correctly in DB

**Acceptance Criteria:**
- All tests pass consistently (run 3 times, all pass)
- Tests use mocks (no real OpenAI/Anthropic API calls)
- Tests are independent (can run in any order)
- Clear test descriptions and meaningful assertions
- Tests complete in <30 seconds each
- Screenshots captured on failure

**Verification:**
```bash
bun run test:e2e -- multi-org-admin-keys.spec.ts
bun run test:e2e -- multi-org-provider-registration.spec.ts
bun run test:e2e -- multi-org-cost-collection.spec.ts

# Run 3 times to check for flakiness
bun run test:e2e -- multi-org --repeat-each=3
```

---

### Batch 6: E2E Tests - Error Scenarios & Edge Cases

**Goal:** Comprehensive error handling and edge case coverage

**Tasks:**
1. Create `__tests__/e2e/multi-org-error-scenarios.spec.ts`:
   - Test: Invalid API key format → error toast with specific message
   - Test: Duplicate admin key (same provider+org) → error toast
   - Test: Invalid project ID format → validation error
   - Test: Invalid project ID (valid format, wrong ID) → API validation fails
   - Test: Missing admin key for provider → info message in project settings
   - Test: Cost collection fails for one org → other orgs succeed (error isolation)
   - Test: Orphaned project (admin key deleted) → warning displayed
   - Test: Network error during validation → retry button appears

2. Add accessibility tests to existing test files:
   - Add `await assertNoCriticalAccessibilityViolations(page)` after page loads
   - Test keyboard navigation (Tab, Enter, Escape)
   - Test focus management in modals

3. Add performance checks:
   - Measure page load time for team settings
   - Measure page load time for project settings
   - Verify no CLS (Cumulative Layout Shift)

**Acceptance Criteria:**
- All error scenarios properly tested
- Accessibility violations = 0 (critical/serious)
- Performance metrics within thresholds:
  - LCP < 2.5s
  - FID < 100ms
  - CLS < 0.1
- All E2E tests pass

**Verification:**
```bash
bun run test:e2e -- multi-org-error-scenarios.spec.ts
bun run test:e2e -- multi-org --grep "accessibility"
bun run test:e2e -- multi-org --grep "performance"
```

---

### Batch 7: Refactor Existing E2E Tests

**Goal:** Update existing tests to work with multi-org schema

**Tasks:**
1. Update `__tests__/e2e/user-journey.spec.ts`:
   - Add step: Register admin key before creating project
   - Add step: Register AI provider for project
   - Update selectors if UI changed
   - Ensure test still passes

2. Update `__tests__/e2e/cost-runaway.spec.ts`:
   - Add step: Register admin key for team
   - Add step: Link project to AI provider
   - Update cost collection mocks for multi-org format
   - Verify cost runaway detection still works

3. Update `__tests__/e2e/weekly-report.spec.ts`:
   - Ensure report generation works with multi-org costs
   - Verify cost attribution is correct

4. Update `__tests__/e2e/error-toast.spec.ts`:
   - Update if any error toast behavior changed

5. Update `__tests__/e2e/helpers.ts`:
   - Deprecate old helpers with comments
   - Add migration guide in comments
   - Keep old helpers for backward compatibility

**Acceptance Criteria:**
- All existing E2E tests pass
- No breaking changes to test infrastructure
- Clear migration comments for future test writers
- Deprecated helpers still work but show warnings

**Verification:**
```bash
# Run full E2E suite
bun run test:e2e

# Should see all tests pass
```

---

### Batch 8: Documentation & Cleanup

**Goal:** Complete documentation and final polish

**Tasks:**
1. Update `__tests__/e2e/README.md`:
   - Document new page objects (TeamSettingsPage, ProjectProviderPage)
   - Document new helpers (registerAdminKey, registerAIProvider, etc.)
   - Document new mocks (mockOpenAICostsAPI, etc.)
   - Add code examples for multi-org testing
   - Add troubleshooting section for common issues

2. Update project documentation:
   - Update `docs/plans/2025-01-04-multi-org-implementation-plan.md` status to COMPLETE
   - Add link to this design doc
   - Document UI changes with screenshots
   - Add user guide for multi-org features

3. Code cleanup:
   - Remove any commented-out code
   - Remove console.logs
   - Add JSDoc comments to all public functions
   - Ensure consistent code style (run Biome/Prettier)
   - Remove unused imports

4. Final verification:
   - Run full test suite (unit + E2E): `bun run test && bun run test:e2e`
   - Run typecheck: `bun run typecheck`
   - Run build: `bun run build`
   - Test manually in dev environment
   - Check Lighthouse scores for new pages
   - Review git diff for any accidental changes

**Acceptance Criteria:**
- Documentation is complete and accurate
- All tests pass (unit + E2E)
- No type errors
- Build succeeds
- No console errors in browser
- Code style is consistent
- Lighthouse scores: Performance >90, Accessibility 100

**Verification:**
```bash
# Full test suite
bun run test
bun run test:e2e

# Type checking
bun run typecheck

# Build
bun run build

# Start dev server and manual test
bun run dev

# Check for any issues
git status
git diff
```

---

## Summary

### Total Scope
- **8 batches**
- **~45 individual tasks**
- **Estimated effort:** 2-3 days for experienced developer

### Execution Strategy
1. **Sequential batches** - Complete one batch before moving to next
2. **Test-driven** - E2E tests written alongside implementation
3. **No breaking changes** - Existing functionality preserved
4. **Progressive enhancement** - Build on existing infrastructure

### Risk Mitigation
- **Foundation first** - Mocks and page objects before UI changes
- **Backend before frontend** - tRPC procedures before React components
- **Tests validate each layer** - Unit tests → Component tests → E2E tests
- **Existing tests ensure no regressions** - Refactor existing tests last

### Quality Gates (Must Pass Before Next Batch)
1. All tests pass (unit + E2E)
2. No TypeScript errors
3. Build succeeds
4. Manual testing confirms expected behavior
5. No accessibility violations (critical/serious)

### Success Criteria (Final)
✅ Complete E2E test coverage for multi-org flows
✅ UI supports multiple admin keys per team
✅ UI supports AI provider registration with real-time validation
✅ All existing tests still pass
✅ Accessibility compliance (WCAG 2.1 AA)
✅ Performance maintained
✅ Documentation complete
✅ Zero regressions

---

## Appendix

### API Endpoints Summary

**Team Router:**
- `getAdminApiKeys` - Query: Get all admin keys for team
- `registerAdminApiKey` - Mutation: Register new admin key (existing)
- `deleteAdminApiKey` - Mutation: Delete admin key (NEW)
- `toggleAdminApiKey` - Mutation: Toggle active status (NEW)

**Project Router:**
- `registerAIProvider` - Mutation: Link project to AI provider (existing)
- `validateAIProjectId` - Query: Real-time project ID validation (NEW)
- `unlinkAIProvider` - Mutation: Remove provider association (NEW)

### Component Hierarchy

```
TeamSettingsPage
└── AdminKeyManager
    ├── AdminKeyRegistrationForm
    │   └── ProviderBadge
    └── AdminKeyList
        └── AdminKeyCard (multiple)
            └── ProviderBadge

ProjectSettingsPage
├── AIProviderConfiguration (new section)
│   ├── AIProviderRegistration (if not configured)
│   │   ├── ProviderBadge
│   │   └── ValidationIndicator
│   └── AIProviderDisplay (if configured)
│       └── ProviderBadge
└── AlertSettings (existing)
```

### Database Schema Reference

**OrganizationApiKey**
```prisma
model OrganizationApiKey {
  id               String   @id @default(cuid())
  teamId           String   @map("team_id")
  provider         String   // 'openai' | 'anthropic' | 'aws' | 'azure'
  organizationId   String?  @map("organization_id")
  displayName      String?  @map("display_name")
  encryptedKey     String   @map("encrypted_key")
  encryptedDataKey String   @map("encrypted_data_key")
  iv               String
  isActive         Boolean  @default(true) @map("is_active")
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@unique([teamId, provider, organizationId], name: "unique_team_provider_org")
  @@map("organization_api_keys")
}
```

**Project (Extended)**
```prisma
model Project {
  id               String   @id @default(cuid())
  name             String
  teamId           String   @map("team_id")
  aiProvider       String?  @map("ai_provider")
  aiOrganizationId String?  @map("ai_organization_id")
  aiProjectId      String?  @map("ai_project_id")
  // ... other fields ...

  @@unique([aiProvider, aiOrganizationId, aiProjectId], name: "unique_provider_org_project")
}
```

### Provider Validation Patterns

```typescript
const PROJECT_ID_PATTERNS = {
  openai: /^proj_[a-zA-Z0-9_-]+$/,
  anthropic: /^(workspace_|ws_)[a-zA-Z0-9_-]+$/,
  aws: /^[a-zA-Z0-9_-]+$/,
  azure: /^[a-zA-Z0-9_-]+$/,
};
```

### Test Data Builders

```typescript
// Example usage in tests
const adminKey = buildAdminKey({
  provider: 'openai',
  organizationId: 'org-test123',
  displayName: 'Production Org',
  apiKey: 'sk-test-1234567890',
});

const project = buildProject({
  aiProvider: 'openai',
  aiOrganizationId: 'org-test123',
  aiProjectId: 'proj_test456',
});
```

---

**End of Design Document**
