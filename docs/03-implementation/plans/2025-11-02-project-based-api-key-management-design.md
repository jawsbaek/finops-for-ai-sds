# Project-Based API Key Management Design

**Date:** 2025-11-02
**Status:** Approved
**Breaking Change:** Yes

## Overview

Transition from Team-based API key management to Project-based API key management to enable:
- Project-level API key isolation
- Fine-grained cost tracking per project
- Team administrators can emergency-disable any project's API keys
- Project members can manage their own API keys

## Background

### Current Architecture

```
Team → API Keys (1:N)
Team → Projects (1:N)
Cost Data → Team (API Key based auto-attribution)
```

**Limitations:**
- Cannot track which project uses which API key
- All team members share the same API keys
- No project-level cost isolation

### New Architecture

```
Team → Projects (1:N)
Project → API Keys (1:N)
Project → Project Members (N:M via User)
Cost Data → Project (API Key based auto-attribution)
Team Cost = SUM(All Project Costs)
```

## Requirements

1. **API Key Management:**
   - Each project owns its API keys
   - Project members can add/view/disable API keys for their projects
   - Team owner/admin can view/disable API keys for ALL projects (emergency control)

2. **Project Membership:**
   - Team members are not automatically project members
   - Team owner/admin can add/remove project members
   - Simple membership model (no roles within project)

3. **Cost Attribution:**
   - Costs are attributed directly to projects based on API keys
   - Team-level costs are aggregated from all project costs

4. **Migration Strategy:**
   - Clean break: Delete all existing Team API keys
   - Auto-add all team members to all existing projects (for continuity)
   - Users must re-register API keys per project

## Data Model Changes

### New Table: `project_members`

```prisma
model ProjectMember {
  id        String   @id @default(cuid())
  projectId String   @map("project_id")
  userId    String   @map("user_id")
  createdAt DateTime @default(now()) @map("created_at")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([projectId, userId])
  @@index([userId])
  @@map("project_members")
}
```

### Modified Table: `api_keys`

**Before:**
```prisma
teamId String @map("team_id")
team   Team   @relation(fields: [teamId], references: [id], onDelete: Cascade)
```

**After:**
```prisma
projectId String  @map("project_id")
project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
```

### Modified Table: `cost_data`

**Before:**
```prisma
teamId String? @map("team_id")
team   Team?   @relation(fields: [teamId], references: [id])
```

**After:**
```prisma
projectId String? @map("project_id")
project   Project? @relation(fields: [projectId], references: [id])
```

### Updated: `Project` Model

```prisma
model Project {
  // Existing fields...

  // New relations
  members  ProjectMember[]
  apiKeys  ApiKey[]
  costData CostData[]
}
```

## Migration Strategy

### Phase 1: Schema Migration

1. Create `project_members` table
2. Migrate `api_keys.teamId` → `api_keys.projectId`
3. Migrate `cost_data.teamId` → `cost_data.projectId`

### Phase 2: Data Migration

```typescript
async function migrate() {
  // 1. Find all teams with projects and members
  const teams = await db.team.findMany({
    include: {
      projects: true,
      members: { include: { user: true } }
    }
  });

  // 2. Add all team members to all projects in that team
  for (const team of teams) {
    for (const project of team.projects) {
      for (const member of team.members) {
        await db.projectMember.create({
          data: {
            projectId: project.id,
            userId: member.userId
          }
        });
      }
    }
  }

  // 3. Delete all Team API keys with audit log
  const deletedKeys = await db.apiKey.findMany({
    where: { teamId: { not: null } }
  });

  for (const key of deletedKeys) {
    await db.auditLog.create({
      data: {
        actionType: 'api_key_migration_deleted',
        userId: 'system',
        metadata: { apiKeyId: key.id, teamId: key.teamId }
      }
    });
  }

  await db.apiKey.deleteMany({
    where: { teamId: { not: null } }
  });

  // 4. Set existing cost_data.teamId to NULL (preserve history)
  await db.costData.updateMany({
    where: { teamId: { not: null } },
    data: { teamId: null }
  });
}
```

## API Changes

### `project.ts` Router - New Procedures

**Project Member Management:**

```typescript
addMember: protectedProcedure
  .input(z.object({
    projectId: z.string(),
    userId: z.string(),
  }))
  .mutation(async ({ ctx, input }) => {
    // Only Team owner/admin can add members
    await ensureTeamAdmin(ctx.session.user.id, projectId);
    // Add member to project
  })

removeMember: protectedProcedure
  .input(z.object({
    projectId: z.string(),
    userId: z.string(),
  }))
  .mutation(async ({ ctx, input }) => {
    // Only Team owner/admin can remove members
    await ensureTeamAdmin(ctx.session.user.id, projectId);
    // Remove member from project
  })

getMembers: protectedProcedure
  .input(z.object({ projectId: z.string() }))
  .query(async ({ ctx, input }) => {
    // Project member or Team admin can view
    await ensureProjectAccess(ctx.session.user.id, projectId);
    // Return project members
  })
```

**API Key Management:**

```typescript
generateApiKey: protectedProcedure
  .input(z.object({
    projectId: z.string(),
    provider: z.literal("openai"),
    apiKey: z.string(),
  }))
  .mutation(async ({ ctx, input }) => {
    // Project member OR Team admin can add
    await ensureProjectAccess(ctx.session.user.id, input.projectId);
    // Encrypt and store API key
  })

getApiKeys: protectedProcedure
  .input(z.object({ projectId: z.string() }))
  .query(async ({ ctx, input }) => {
    // Project member OR Team admin can view
    await ensureProjectAccess(ctx.session.user.id, input.projectId);
    // Return API keys
  })

disableApiKey: protectedProcedure
  .input(z.object({
    apiKeyId: z.string(),
    reason: z.string(),
  }))
  .mutation(async ({ ctx, input }) => {
    // Project member OR Team admin can disable
    const apiKey = await db.apiKey.findUnique({
      where: { id: input.apiKeyId },
      include: { project: true }
    });
    await ensureProjectAccess(ctx.session.user.id, apiKey.projectId);
    // Disable API key with audit log
  })
```

### Helper Functions

```typescript
async function ensureProjectAccess(userId: string, projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      members: { where: { userId } },
      team: {
        include: {
          members: { where: { userId, role: { in: ['owner', 'admin'] } } }
        }
      }
    }
  });

  if (!project) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
  }

  const isProjectMember = project.members.length > 0;
  const isTeamAdmin = project.team.members.length > 0;

  if (!isProjectMember && !isTeamAdmin) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'No access to this project' });
  }

  return { isProjectMember, isTeamAdmin };
}

async function ensureTeamAdmin(userId: string, projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      team: {
        include: {
          members: { where: { userId, role: { in: ['owner', 'admin'] } } }
        }
      }
    }
  });

  if (!project?.team.members.length) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Team admin access required' });
  }
}
```

### `team.ts` Router - Changes

**Remove:**
- `team.generateApiKey` (moved to project)

**Modify:**
- `team.getById`: Remove `apiKeys` from include, add `projects.apiKeys`
- `team.disableApiKey`: Remove (consolidated into project.disableApiKey)

## Cost Collection Changes

### Daily Batch Cron Job

**Before:**
```typescript
// Get all active Team API keys
const apiKeys = await db.apiKey.findMany({
  where: { isActive: true },
  include: { team: true }
});

// Create cost data with teamId
await db.costData.create({
  data: {
    teamId: apiKey.teamId,
    // ...
  }
});
```

**After:**
```typescript
// Get all active Project API keys
const apiKeys = await db.apiKey.findMany({
  where: { isActive: true },
  include: { project: { include: { team: true } } }
});

// Create cost data with projectId
await db.costData.create({
  data: {
    projectId: apiKey.projectId,
    // ...
  }
});
```

### Team Cost Aggregation

**Team dashboard:**
```typescript
const teamCost = await db.costData.groupBy({
  by: ['date'],
  where: {
    project: { teamId: teamId },
    date: { gte: startDate, lte: endDate }
  },
  _sum: {
    totalCost: true,
    totalTokens: true
  }
});
```

**Dashboard "Team Cost Top 5" chart:**
```typescript
const topTeams = await db.team.findMany({
  include: {
    projects: {
      include: {
        costData: {
          where: { date: { gte: last7Days } }
        }
      }
    }
  }
});

// Aggregate each team's project costs
const teamCosts = topTeams.map(team => ({
  teamId: team.id,
  teamName: team.name,
  totalCost: team.projects.reduce((sum, project) =>
    sum + project.costData.reduce((pSum, cost) => pSum + cost.totalCost, 0)
  , 0)
}));
```

## UI Changes

### Team Detail Page (`/teams/[teamId]`)

**Remove:**
- API Key Management section
- API Key add/disable dialogs

**Keep:**
- Team info card
- Team member management

**Add:**
- Project summary card
  - List of projects with: name, member count, API key count, total cost
  - Click to navigate to project detail

### Project Detail Page (`/projects/[id]`)

**Existing:**
- Project basic info
- Cost charts
- Metrics

**Add:**

**1. Project Members Section**
- Member list (name, email)
- "Add Member" button (Team admin only)
- "Remove" button per member (Team admin only)

**2. API Key Management Section** (moved from Team page)
- API key list (masked, status, created date)
- "Add API Key" button (project member OR team admin)
- "Disable" button per key (project member OR team admin)
- Special badge for Team admin: "Accessing with Team Admin privileges"

### Project Creation Flow

**Before:**
```
1. Create project (name, description, teamId)
2. Done
```

**After:**
```
1. Create project (name, description, teamId)
2. Auto-add creator as first project member
3. Redirect to project detail page
4. Show message: "Add API keys to start cost tracking"
```

### Access Control UI

**Team admin (not project member):**
- Can view project
- Can disable API keys (emergency control)
- Can add API keys and manage members
- Badge: "Team Admin Access"

**Project member:**
- Full access to project features
- Cannot add/remove members (Team admin only)

**Non-member (Team member but not project member):**
- Project visible in list but marked "No Access"
- Click shows: "You are not a member of this project"

## Implementation Plan

### Phase 1: Database & Backend (Breaking Change)

1.1. Schema changes
- Add `project_members` table
- Modify `api_keys`: `teamId` → `projectId`
- Modify `cost_data`: `teamId` → `projectId`
- Generate and run Prisma migration

1.2. Migration script
- Auto-add all team members to all projects
- Delete existing Team API keys (with audit log)
- Set existing cost_data.teamId to NULL

1.3. tRPC API changes
- `project.ts`: Add member management, API key management procedures
- `team.ts`: Remove/modify API key procedures
- Implement permission helper functions
- Update cost aggregation logic

### Phase 2: Cost Collection

2.1. Daily Batch Cron Job
- Change to Project-based API key collection
- Use projectId in CostData creation

2.2. Weekly Report
- Update Team cost calculation (sum of project costs)

### Phase 3: Frontend UI

3.1. Team detail page
- Remove API key section
- Add project summary card

3.2. Project detail page
- Add project members section
- Add API key management section
- Implement permission-based UI display

3.3. Project creation flow
- Auto-add creator as member
- Show guidance message

### Phase 4: Testing & Validation

4.1. Integration tests
- Project member add/remove
- API key registration (project member)
- API key disable (Team admin)
- Cost data collection and aggregation

4.2. Permission tests
- Non-member access restriction
- Team admin access to all projects

4.3. Migration tests
- Existing data conversion
- User notification messages

### Phase 5: Documentation

5.1. Update architecture docs
- Novel Pattern 2: Project-based API key isolation
- Permission model documentation

5.2. Update integration testing guide
- New test scenarios for project-based workflow

## Implementation Order

```
1. [DB] Prisma schema + migration script
2. [Backend] tRPC API (project.ts, team.ts)
3. [Backend] Cost collection logic (cron jobs)
4. [Frontend] Project detail page UI
5. [Frontend] Team detail page UI
6. [Test] Integration and permission tests
7. [Docs] Architecture documentation update
```

## Breaking Changes

**User Impact:**
- All API keys must be re-registered per project
- Team members need to be added to projects to access them (initially auto-added)

**API Changes:**
- `team.generateApiKey` → `project.generateApiKey`
- `team.disableApiKey` → `project.disableApiKey`

**Data Structure:**
- `CostData.teamId` → `CostData.projectId`
- `ApiKey.teamId` → `ApiKey.projectId`

## Rollback Plan

If issues occur:
1. Database migration rollback
2. Revert to previous code version
3. Restore API key data from audit log backup

## Success Criteria

1. ✅ Project members can add API keys to their projects
2. ✅ Team admins can view and disable all project API keys
3. ✅ Costs are accurately attributed to projects
4. ✅ Team costs are correctly aggregated from project costs
5. ✅ Non-project-members cannot access project resources
6. ✅ All existing projects have members after migration

## Novel Pattern Update

**Previous: Team-Based API Key Isolation**
- Teams own API keys
- Costs attributed to teams via API key

**New: Project-Based API Key Isolation**
- Projects own API keys
- Costs attributed to projects via API key
- Team costs = aggregate of all project costs
- Team admins retain emergency control over all project API keys
