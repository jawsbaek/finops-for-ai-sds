# Migration Documentation

This folder contains documentation for the OpenAI Costs API migration completed on 2025-01-04.

## Migration Overview

**Migration**: OpenAI Usage API → OpenAI Costs API
**Date**: 2025-01-04
**Impact**: High (12 breaking changes)
**Status**: Documentation Complete, Implementation Pending

**Key Change**: Team-level Admin API Keys + Project ID filtering (instead of project-level API keys)

---

## Documents

### 1. Migration Summary ⭐
**File**: `MIGRATION_SUMMARY.md` (31KB)
**Purpose**: Comprehensive migration overview and implementation guide

**Contains**:
- Executive summary of architectural changes
- 8 core documents updated
- 59-item implementation checklist (Developer, Product, Operations)
- 5-week rollout plan
- Migration statistics and lessons learned

**Use this when**:
- Understanding the migration scope
- Planning implementation tasks
- Reviewing architectural changes
- Creating deployment checklists

**Audience**: All stakeholders (developers, product managers, operations)

---

### 2. Breaking Changes Reference
**File**: `BREAKING_CHANGES.md` (9.7KB)
**Purpose**: User-facing breaking changes documentation

**Contains**:
- 12 breaking changes with severity ratings
- User impact assessment
- Migration paths for each change
- API endpoint changes
- Database schema changes

**Use this when**:
- Communicating changes to users
- Planning user migration support
- Understanding API contract changes
- Writing migration guides

**Audience**: End users, support team, product managers

---

## Migration Timeline

### Documentation Phase (Completed)
✅ **2025-01-04**: All core documents updated
- Architecture (architecture-v2.md)
- Tech Spec (tech-spec-epic-1-v2.md)
- PRD (PRD-v2.md)
- Epics (epics-v2.md)
- Stories (Story 1.2, 1.7 updated)
- Setup Guide (SETUP-v2.md)

### Implementation Phase (Pending)
**Week 1-2**: Review & Approval
- Stakeholder review of updated docs
- Finalize deployment timeline

**Week 3-4**: Development
- Backend implementation (Stories 1.2, 1.7)
- Frontend implementation (Team/Project Settings)
- Testing (Unit, Integration, E2E)

**Week 5**: Deployment
- Production deployment
- User onboarding
- Monitoring & stabilization

---

## Key Architectural Changes

### Before (Usage API)
```
Project → API Key (project-level) → Usage API → Cost Data
```

### After (Costs API)
```
Team → Admin API Key (org-level)
  ├─ Project 1 → OpenAI Project ID (proj_abc)
  ├─ Project 2 → OpenAI Project ID (proj_def)
  └─ Project 3 → OpenAI Project ID (proj_ghi)
       ↓
Costs API (project_ids filter) → Cost Buckets → Project ID Mapping → Cost Data
```

### New Components
1. **OrganizationApiKey** table (team-level Admin Keys, KMS encrypted)
2. **Project.openaiProjectId** field (unique Project ID mapping)
3. **cost-collector-v2.ts** (Costs API client with pagination)
4. **4 new tRPC procedures** (Admin Key + Project ID management)

---

## Quick Links

### Core Documentation
- [Architecture v2](/docs/01-planning/architecture.md) - System architecture with Costs API
- [Tech Spec Epic 1 v2](/docs/01-planning/tech-spec-epic-1.md) - Epic 1 technical specification
- [PRD v2](/docs/01-planning/PRD.md) - Product requirements with Costs API features
- [Epics v2](/docs/01-planning/epics.md) - Story 1.2, 1.7 updated
- [Setup v2](/docs/05-operations/SETUP.md) - Setup guide with Admin Key registration

### Implementation Guides
- [Story 1.2 v2](/docs/03-implementation/stories/1-2-openai-costs-api-비용-일일-배치-수집-시스템.md) - Costs API collection
- [Story 1.7 v2](/docs/03-implementation/stories/1-7-팀-admin-api-키-및-프로젝트-id-관리.md) - Admin Key & Project ID management

### Migration Documents
- [Migration Summary](./MIGRATION_SUMMARY.md) - Comprehensive migration guide
- [Breaking Changes](./BREAKING_CHANGES.md) - User-facing changes

---

## Archived Documents

The following documents have been moved to `/docs/archive/` after completion:

- `costs-api-migration-plan.md` - Detailed technical migration plan (merged into MIGRATION_SUMMARY)
- `DOCUMENTATION_REWRITE_CHECKLIST.md` - Rewrite instructions (completed)
- `COMPLETION_REPORT.md` - Documentation sync completion report (completed)

These documents are available for historical reference but are not needed for ongoing implementation.

---

## Success Metrics

| Metric | Target | Measure |
|--------|--------|---------|
| Admin API Key Registration | 80% of teams | `organization_api_keys.is_active = true` |
| Project ID Registration | 70% of projects | `projects.openai_project_id IS NOT NULL` |
| Costs API Collection Success | >95% | Cron job logs |
| Data Accuracy | ±5% | Usage API vs. Costs API comparison |
| Zero P0 Incidents | 100% | Sentry/monitoring |

---

**Last Updated**: 2025-01-04
**Migration Status**: Documentation Complete
**Next Milestone**: Week 1 - Stakeholder Review & Approval
