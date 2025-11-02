# User to Team Migration Guide

## 배경

기존에는 회원가입 시 사용자만 생성하고 팀을 자동으로 만들지 않았습니다. 이로 인해 신규 사용자가 프로젝트를 생성할 수 없는 문제가 발생했습니다.

### 수정 내용

- **회원가입 로직 수정** (`src/server/api/routers/auth.ts`)
  - 신규 사용자 가입 시 개인 팀 자동 생성
  - 사용자를 'owner' 역할로 팀에 추가
  - 팀 이름: `{name}'s Team` 또는 `{email}'s Team`

### 영향 받는 사용자

이미 가입한 사용자들은 팀이 없는 상태입니다. 이들을 위해 마이그레이션이 필요합니다.

## 마이그레이션 스크립트 실행

### 1. Dry Run (미리보기)

실제 변경 없이 어떤 사용자들이 영향을 받는지 확인합니다.

```bash
# 방법 1: npm/bun 스크립트 사용
bun run migrate:users

# 방법 2: 직접 실행
bun run scripts/migrate-users-to-teams.ts
```

**출력 예시:**
```
🔍 User to Team Migration Script

⚠️  DRY RUN MODE - No changes will be made
   Run with --execute to apply changes

📊 Finding users without teams...

📋 Found 3 user(s) without teams:

   • user1@example.com → "John's Team"
   • user2@example.com → "user2's Team"
   • admin@example.com → "Admin User's Team"

⏸️  Dry run complete. Use --execute to apply changes.
```

### 2. 실제 마이그레이션 실행

```bash
# 방법 1: npm/bun 스크립트 사용
bun run migrate:users --execute

# 방법 2: 직접 실행
bun run scripts/migrate-users-to-teams.ts --execute
```

**출력 예시:**
```
🔍 User to Team Migration Script

🚀 EXECUTION MODE - Changes will be applied

📊 Finding users without teams...

📋 Found 3 user(s) without teams:

   • user1@example.com → "John's Team"
   • user2@example.com → "user2's Team"
   • admin@example.com → "Admin User's Team"

🔄 Starting migration...

   ✅ user1@example.com → Team created
   ✅ user2@example.com → Team created
   ✅ admin@example.com → Team created

==================================================
📊 Migration Summary
==================================================
✅ Success: 3
❌ Failed:  0
📊 Total:   3
==================================================

🎉 Migration completed successfully!
```

## 배포 체크리스트

### 배포 전

- [ ] 코드 리뷰 완료
- [ ] 타입 체크 통과 (`bun run typecheck`)
- [ ] 빌드 성공 확인

### 배포 후

1. **마이그레이션 스크립트 실행 (프로덕션)**
   ```bash
   # 1. 프로덕션 서버에 접속

   # 2. Dry run으로 확인
   bun run migrate:users

   # 3. 문제없으면 실행
   bun run migrate:users --execute
   ```

2. **검증**
   - [ ] 기존 사용자들이 프로젝트 생성 가능한지 확인
   - [ ] 신규 사용자 가입 시 자동으로 팀 생성되는지 확인
   - [ ] 에러 로그 확인

## 롤백 계획

만약 문제가 발생한 경우:

1. **즉시 롤백**
   ```bash
   git revert <commit-hash>
   ```

2. **수동으로 생성된 팀 삭제** (필요시)
   ```sql
   -- 주의: 실행 전 백업 필수!
   -- 마이그레이션으로 생성된 팀만 삭제
   DELETE FROM team_members WHERE team_id IN (
     SELECT id FROM teams WHERE name LIKE '%''s Team'
   );
   DELETE FROM teams WHERE name LIKE '%''s Team';
   ```

## 기술 세부사항

### 마이그레이션 로직

```typescript
// 1. 팀이 없는 사용자 찾기
const usersWithoutTeams = await db.user.findMany({
  where: {
    teamMemberships: {
      none: {},
    },
  },
});

// 2. 각 사용자에게 팀 생성
for (const user of usersWithoutTeams) {
  await db.team.create({
    data: {
      name: `${user.name || user.email.split("@")[0]}'s Team`,
      members: {
        create: {
          userId: user.id,
          role: "owner",
        },
      },
    },
  });
}
```

### 신규 회원가입 로직

```typescript
// src/server/api/routers/auth.ts
const user = await ctx.db.user.create({
  data: {
    email,
    passwordHash,
    name,
    teamMemberships: {
      create: {
        role: "owner",
        team: {
          create: {
            name: `${name || email.split("@")[0]}'s Team`,
          },
        },
      },
    },
  },
});
```

## 문의

문제가 발생하거나 질문이 있는 경우 개발팀에 문의하세요.
