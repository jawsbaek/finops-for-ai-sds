# Archived Documentation

This folder contains historical documents that are no longer actively used but preserved for reference.

## Archive Policy

Documents are archived when they are:
- **Completed**: Task checklists, completion reports, session notes
- **Superseded**: Design documents replaced by newer versions
- **Consolidated**: Detailed plans merged into summary documents

Archived documents are **read-only** and should not be updated.

---

## Archived Documents

### Brainstorming & Planning Sessions

#### 1. BMM Brainstorming Session (2025-10-31)
**File**: `bmm-brainstorming-session-2025-10-31.md` (26KB)
**Archived**: 2025-11-01
**Reason**: Completed session notes

Initial brainstorming session covering:
- Product vision and goals
- Market analysis
- Feature prioritization
- Technical architecture decisions

**Reference value**: Understanding early product decisions and rationale

---

### Validation & Assessment Reports

#### 2. Epic 1 Validation Report
**File**: `epic-1-validation-report.md` (10KB)
**Archived**: 2025-11-02
**Reason**: Validation completed, Epic 1 approved

Validation report for Epic 1 (OpenAI Cost Management System):
- Requirements completeness check
- Technical feasibility assessment
- Risk analysis
- Approval sign-off

**Reference value**: Understanding Epic 1 scope and validation criteria

---

#### 3. Implementation Readiness Report (2025-11-01)
**File**: `implementation-readiness-report-2025-11-01.md` (25KB)
**Archived**: 2025-11-01
**Reason**: Readiness assessment completed

Comprehensive readiness assessment covering:
- Code quality metrics
- Test coverage analysis
- Documentation completeness
- Deployment readiness checklist

**Reference value**: Quality gate checklist template for future epics

**Note**: This document contains valuable quality criteria - consider moving back to active `/docs/05-operations/` if needed.

---

#### 4. Unused Components Review
**File**: `UNUSED_COMPONENTS_REVIEW.md` (8KB)
**Archived**: 2025-11-02
**Reason**: Review completed, components cleaned up

Analysis of unused UI components and cleanup recommendations:
- Component usage analysis
- Dead code detection
- Cleanup action items

**Reference value**: Component audit methodology

---

### Migration Documents (Costs API)

#### 5. Costs API Migration Plan (Detailed)
**File**: `costs-api-migration-plan.md` (39KB)
**Archived**: 2025-01-04
**Reason**: Consolidated into MIGRATION_SUMMARY.md

Original detailed migration plan including:
- Complete code examples (cost-collector-v2.ts)
- Database migration SQL
- tRPC router specifications
- UI implementation details
- Validation scripts

**Reference value**: Detailed code examples and SQL migrations

**See also**: `/docs/04-migration/MIGRATION_SUMMARY.md` (current reference)

---

#### 6. Documentation Rewrite Checklist
**File**: `DOCUMENTATION_REWRITE_CHECKLIST.md` (33KB)
**Archived**: 2025-01-04
**Reason**: All rewrite tasks completed

Section-by-section instructions for updating 8 core documents:
- 47 individual update tasks
- Before/after comparisons
- Quality gates and validation criteria

**Reference value**: Template for future major documentation updates

---

#### 7. Migration Completion Report
**File**: `COMPLETION_REPORT.md` (11KB)
**Archived**: 2025-01-04
**Reason**: Migration documentation phase complete

Final status report for Costs API migration documentation:
- 11 documents updated
- 2,800+ lines added
- Cross-document alignment verification
- Next steps and review checklist

**Reference value**: Migration success metrics and methodology

---

## Removed Documents

The following documents were deleted (not archived) due to minimal value:

### Deleted 2025-11-04
- `research-deep-prompt-2025-10-31.md` - Input prompt only, no output or analysis
- `bmm-workflow-status.yaml` - Superseded by `/docs/03-implementation/sprint-status.yaml`

---

## Archive Statistics

| Category | Documents | Total Size | Date Range |
|----------|-----------|------------|------------|
| Brainstorming Sessions | 1 | 26KB | 2025-10-31 |
| Validation Reports | 3 | 43KB | 2025-11-01 - 2025-11-02 |
| Migration Docs | 3 | 83KB | 2025-01-04 |
| **Total** | **7** | **152KB** | **Oct-Jan 2025** |

---

## When to Reference Archived Documents

### Use archived documents when:
1. **Historical context needed**: Understanding why decisions were made
2. **Template needed**: Reusing checklist formats or report structures
3. **Code examples needed**: Detailed implementation examples (costs-api-migration-plan.md)
4. **Audit trail needed**: Compliance or governance requirements

### Do not use archived documents for:
1. **Current implementation**: Always use active docs in `/docs/`
2. **API references**: May be outdated, check active architecture docs
3. **Feature specifications**: Use current PRD, epics, and stories

---

## Quick Navigation

- **Active Documentation**: `/docs/`
- **Planning Phase**: `/docs/01-planning/`
- **Migration Docs**: `/docs/04-migration/`
- **Operations Docs**: `/docs/05-operations/`

---

**Archive Created**: 2025-11-04
**Last Updated**: 2025-11-04
**Total Archived Documents**: 7
**Next Review**: 2025-04-01 (Consider purging docs older than 6 months)
