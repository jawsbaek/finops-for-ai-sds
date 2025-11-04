# Project Member and API Key Management Design

**Date:** 2025-11-03
**Feature:** Complete project detail page with member and API key management
**Branch:** feature/project-management

## Overview

Enhance the project detail page by adding comprehensive member management and API key management features. Currently, the page only shows emergency API key disabling. This design extends it to include full CRUD operations for both members and API keys.

## Goals

1. Enable team admins to manage project members (add, remove, view)
2. Provide complete API key lifecycle management (create, list, disable, enable, delete)
3. Maintain clean UI/UX with modal-based interactions
4. Ensure proper security and permission controls

## User Requirements (Confirmed)

**Member Management:**
- View all project members with their details
- Add team members to the project (Team admin only)
- Remove members from the project (Team admin only)
- Display member roles/permissions

**API Key Management:**
- Create and add new API keys to the project
- View all API keys with their status
- Disable API keys (emergency response)
- Enable previously disabled API keys
- Delete API keys permanently
- Integrate emergency disable feature into the unified section

## Architecture

### Page Structure

The project detail page will be reorganized with the following section order:

```
1. Header (existing)
2. Stats Overview (existing)
3. 🆕 Project Members Section
4. 🔄 API Keys Management Section (integrated & expanded)
5. Charts Grid (existing)
6. Performance Metrics (existing)
```

**Rationale:** Management features (Members, API Keys) are placed above analytics (Charts, Metrics) for better accessibility and logical flow.

### Component Architecture

#### New Components

**Member Management:**
- `ProjectMembersSection` - Main section container
- `AddMemberDialog` - Modal for adding members
- `MemberCard` - Individual member display card

**API Key Management:**
- `ApiKeysSection` - Unified API key management section
- `AddApiKeyDialog` - Modal for adding API keys
- `ConfirmDeleteKeyDialog` - Delete confirmation dialog
- Reuse: `ConfirmDisableKeyDialog` (existing)

### Data Flow

#### Member Management APIs

```typescript
// Query: Get project members
api.project.getMembers.useQuery({ projectId })
// Returns: Array<{ id, user: { id, name, email }, createdAt }>

// Mutation: Add member
api.project.addMember.useMutation()
// Input: { projectId, userId }
// Permission: Team admin only

// Mutation: Remove member
api.project.removeMember.useMutation()
// Input: { projectId, userId }
// Permission: Team admin only

// Query: Get team members (for dropdown)
api.team.getMembers.useQuery({ teamId })
// Returns: Array of team members
```

#### API Key Management APIs

```typescript
// Query: Get API keys (included in project.getById)
project.apiKeys
// Returns: Array<{ id, provider, isActive, createdAt, last4 }>

// Mutation: Add API key (existing)
api.project.generateApiKey.useMutation()
// Input: { projectId, provider: "openai", apiKey: string }

// Mutation: Disable API key (existing)
api.project.disableApiKey.useMutation()
// Input: { apiKeyId, reason: string }

// Mutation: Enable API key (NEW)
api.project.enableApiKey.useMutation()
// Input: { apiKeyId, reason?: string }

// Mutation: Delete API key (NEW)
api.project.deleteApiKey.useMutation()
// Input: { apiKeyId, reason: string }
```

## Backend Changes

### New API Endpoints Required

#### 1. Team Router - Get Members

```typescript
// src/server/api/routers/team.ts (create or extend)
getMembers: protectedProcedure
  .input(z.object({ teamId: z.string() }))
  .query(async ({ input, ctx }) => {
    // Verify user is a member of the team
    // Return all team members
  })
```

#### 2. Project Router - Enable API Key

```typescript
// src/server/api/routers/project.ts
enableApiKey: protectedProcedure
  .input(z.object({
    apiKeyId: z.string(),
    reason: z.string().optional()
  }))
  .mutation(async ({ input, ctx }) => {
    // Check permissions (ensureProjectAccess)
    // Update isActive to true
    // Create audit log
  })
```

#### 3. Project Router - Delete API Key

```typescript
// src/server/api/routers/project.ts
deleteApiKey: protectedProcedure
  .input(z.object({
    apiKeyId: z.string(),
    reason: z.string().min(1)
  }))
  .mutation(async ({ input, ctx }) => {
    // Check permissions (ensureProjectAccess)
    // Hard delete the API key
    // Create audit log
    // Note: CostData.apiKeyId is nullable, so cascade is safe
  })
```

### Permission Matrix

| Action | Who Can Perform |
|--------|----------------|
| View members | Project members + Team admin |
| Add member | Team admin only |
| Remove member | Team admin only |
| View API keys | Project members + Team admin |
| Add API key | Project members + Team admin |
| Disable API key | Project members + Team admin |
| Enable API key | Project members + Team admin |
| Delete API key | Project members + Team admin |

### Security Considerations

**Authentication & Authorization:**
- Use existing `ensureProjectAccess()` for API key operations
- Use existing `ensureTeamAdmin()` for member operations
- All mutations require authenticated user

**Data Protection:**
- API keys always encrypted at rest
- Never expose full API key to client (only last4)
- API key input field uses password type (masked)

**Audit Logging:**
- Log all API key lifecycle events (add, disable, enable, delete)
- Log all member changes (add, remove)
- Include userId, reason, and timestamp in audit logs

**Database Safety:**
- API key deletion is safe because `CostData.apiKeyId` is nullable
- Cascade deletes properly configured on ProjectMember

## UI/UX Specifications

### Member Management UX

**Add Member Flow:**
1. Click "멤버 추가" button → Open modal
2. Select from team members dropdown
   - Already-added members are disabled in dropdown
   - Show user name and email
3. Preview selected member
4. Click "추가" → Execute mutation
5. Success: Toast notification + Close modal + Auto-refresh list

**Remove Member Confirmation:**
- Browser confirm dialog
- Message: "정말로 [이름]님을 프로젝트에서 제거하시겠습니까?"

**Empty State:**
- Icon: Users or UserPlus
- Message: "아직 프로젝트 멤버가 없습니다"
- CTA: "첫 멤버 추가하기" (Team admin only)

**Member Card Display:**
- User name (primary)
- Email address (secondary)
- Join date
- Remove button (Team admin only)

### API Key Management UX

**Add API Key Flow:**
1. Click "API 키 추가" → Open modal
2. Select provider (currently OpenAI only)
3. Enter API key (password input, masked)
4. Show security warning: "API 키는 암호화되어 저장되며, 이후 확인할 수 없습니다"
5. Validate format (sk- prefix)
6. Click "추가" → Execute mutation
7. Success: Toast + Close modal + Refresh list

**API Key Status Display:**
- Active: Green badge + "활성" label
- Inactive: Gray badge + "비활성화됨" label
  - Show disable reason if available

**API Key Card Actions:**
- Active key: "비활성화" (destructive) + "삭제" (ghost destructive)
- Inactive key: "재활성화" (default) + "삭제" (ghost destructive)

**API Key Card Display:**
- Provider name (capitalized)
- Status badge
- Masked key: `...{last4}`
- Creation date
- Action buttons

### Error Handling

**Client-side Validation:**
```typescript
// API Key Addition
- Provider selection required
- API key format validation (starts with sk-)
- Non-empty API key

// Member Addition
- User selection required
- Prevent duplicate additions (disable in dropdown)
```

**Server Error Responses:**
```typescript
// CONFLICT - Already added
→ Toast: "이미 프로젝트 멤버입니다"

// FORBIDDEN - No permission
→ Toast: "권한이 없습니다. Team admin만 가능합니다"

// NOT_FOUND - Resource missing
→ Toast: "요청한 리소스를 찾을 수 없습니다"

// BAD_REQUEST - Invalid format
→ Toast: "올바른 OpenAI API 키 형식이 아닙니다"
```

**Loading States:**
- All mutation buttons: Disabled + Loader icon during execution
- Data loading: Skeleton UI
- No optimistic updates (prioritize data consistency)

### Visual Design

**Section Layout:**
```tsx
<Card>
  <CardHeader>
    <div className="flex items-center justify-between">
      <div>
        <Title + Icon />
        <Description />
      </div>
      {canManage && <AddButton />}
    </div>
  </CardHeader>
  <CardContent>
    {items.length > 0 ? (
      <Grid of Cards />
    ) : (
      <EmptyState />
    )}
  </CardContent>
</Card>
```

**Color Coding:**
- Active status: Green (success variant)
- Inactive status: Gray (muted)
- Destructive actions: Red (destructive variant)
- Primary actions: Default blue

## Implementation Plan

### Phase 1: Backend APIs
1. Create team router with `getMembers` endpoint
2. Add `enableApiKey` to project router
3. Add `deleteApiKey` to project router
4. Test all new endpoints

### Phase 2: UI Components
1. Create `AddMemberDialog` component
2. Create `AddApiKeyDialog` component
3. Create `ConfirmDeleteKeyDialog` component
4. Test all dialogs in isolation

### Phase 3: Page Integration
1. Add ProjectMembersSection to detail page
2. Refactor existing API key section into ApiKeysSection
3. Integrate all dialogs
4. Update section ordering

### Phase 4: Testing & Polish
1. Test member management flows (add, remove, permissions)
2. Test API key management flows (add, disable, enable, delete)
3. Test error handling and edge cases
4. Verify audit logging
5. Cross-browser testing

## Success Criteria

- [ ] Team admins can add and remove project members
- [ ] All users can view project members
- [ ] Project members can add API keys
- [ ] API keys can be disabled, enabled, and deleted with proper confirmations
- [ ] All actions are properly logged to audit log
- [ ] Permission checks work correctly
- [ ] UI is responsive and accessible
- [ ] Empty states are informative
- [ ] Error messages are clear and helpful

## Future Enhancements (Out of Scope)

- Member roles within project (beyond Team admin)
- Bulk member operations
- API key usage statistics per key
- API key rotation feature
- Multiple provider support (AWS, Azure, etc.)
- Email notifications for member changes
