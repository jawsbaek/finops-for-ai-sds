# 보안 요구사항 검증

## 개요

이 문서는 Epic 1 Story 1.9 AC #4에 명시된 보안 요구사항의 검증 방법과 결과를 기록합니다.

**검증 날짜**: 2025-11-03
**검증자**: [이름 입력]
**시스템 버전**: [Git commit SHA 입력]

---

## 1. TLS 1.3 연결 확인 (NFR005)

### 요구사항

- 모든 HTTPS 연결은 TLS 1.3 이상을 사용해야 함
- Vercel 배포 시 자동으로 TLS 1.3 활성화

### 검증 방법

#### 1.1. SSL Labs 테스트

**URL**: https://www.ssllabs.com/ssltest/

**절차**:
1. SSL Labs 웹사이트 방문
2. 프로덕션 URL 입력: `https://[your-domain].vercel.app`
3. "Submit" 클릭 및 결과 대기 (2-3분)

**예상 결과**:
- Overall Rating: **A+**
- Protocol Support: TLS 1.3 ✅, TLS 1.2 ✅
- Key Exchange: ECDHE (Forward Secrecy)
- Cipher Strength: 256-bit

#### 1.2. OpenSSL 명령어 테스트

```bash
openssl s_client -connect [your-domain].vercel.app:443 -tls1_3
```

**예상 출력**:
```
SSL-Session:
    Protocol  : TLSv1.3
    Cipher    : TLS_AES_256_GCM_SHA384
    ...
    Verify return code: 0 (ok)
```

#### 1.3. curl 테스트

```bash
curl -I -v --tlsv1.3 https://[your-domain].vercel.app
```

**예상 출력**:
```
* TLSv1.3 (OUT), TLS handshake, Client hello (1):
* TLSv1.3 (IN), TLS handshake, Server hello (2):
...
< HTTP/2 200
```

### 검증 결과

| 테스트 | 결과 | 메모 |
|--------|------|------|
| SSL Labs 테스트 | ☐ 통과 ☐ 실패 | Rating: _____ |
| OpenSSL 테스트 | ☐ 통과 ☐ 실패 | Protocol: _____ |
| curl 테스트 | ☐ 통과 ☐ 실패 | - |

**Overall**: ☐ 통과 ☐ 실패

---

## 2. Security Headers 확인

### 요구사항

다음 보안 헤더가 모든 응답에 포함되어야 함:

- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` (또는 `SAMEORIGIN`)
- `X-XSS-Protection: 1; mode=block`
- `Content-Security-Policy` (권장)

### 검증 방법

```bash
curl -I https://[your-domain].vercel.app
```

**또는**:

브라우저 개발자 도구 → Network 탭 → 응답 헤더 확인

### 검증 결과

| Header | 값 | 결과 |
|--------|------|------|
| Strict-Transport-Security | | ☐ 통과 ☐ 실패 |
| X-Content-Type-Options | | ☐ 통과 ☐ 실패 |
| X-Frame-Options | | ☐ 통과 ☐ 실패 |
| X-XSS-Protection | | ☐ 통과 ☐ 실패 |
| Content-Security-Policy | | ☐ 통과 ☐ 실패 |

**Overall**: ☐ 통과 ☐ 실패

---

## 3. AES-256 암호화 검증 (NFR004)

### 요구사항

- API 키는 AES-256-GCM 알고리즘으로 암호화되어 저장
- AWS KMS Envelope Encryption 사용
- DB에 `encrypted_key`, `encrypted_data_key`, `iv` 저장

### 검증 방법

#### 3.1. Unit Test - KMS Envelope Encryption

**파일**: `src/lib/services/encryption/__tests__/kms-envelope.test.ts`

```typescript
import { KMSEnvelopeEncryption } from '@/lib/services/encryption/kms-envelope';

describe('KMS Envelope Encryption', () => {
  it('should encrypt and decrypt successfully', async () => {
    const encryption = new KMSEnvelopeEncryption();
    const plaintext = 'sk-test1234567890123456789012345678901234567890';

    const { ciphertext, encryptedDataKey, iv } = await encryption.encrypt(plaintext);

    expect(ciphertext).not.toBe(plaintext);
    expect(ciphertext).toHaveLength(greaterThan(plaintext.length));

    const decrypted = await encryption.decrypt(ciphertext, encryptedDataKey, iv);

    expect(decrypted).toBe(plaintext);
  });

  it('should use AES-256-GCM algorithm', async () => {
    // Verify algorithm by checking ciphertext structure
    const encryption = new KMSEnvelopeEncryption();
    const { ciphertext } = await encryption.encrypt('test');

    // AES-256-GCM produces auth tag (16 bytes)
    expect(Buffer.from(ciphertext, 'base64').length).toBeGreaterThan(16);
  });
});
```

**실행**:
```bash
bun test src/lib/services/encryption/__tests__/kms-envelope.test.ts
```

#### 3.2. Integration Test - API Key Manager

**파일**: `__tests__/integration/api-key-manager.test.ts`

```typescript
import { db } from '@/server/db';
import { ApiKeyManager } from '@/lib/services/encryption/api-key-manager';

describe('API Key Manager Integration', () => {
  it('should save and retrieve encrypted API key', async () => {
    const manager = new ApiKeyManager();
    const apiKey = 'sk-test1234567890123456789012345678901234567890';
    const projectId = 'test-project-id';

    // Save encrypted key
    await manager.saveApiKey(projectId, apiKey);

    // Retrieve from DB
    const record = await db.apiKey.findFirst({
      where: { projectId },
    });

    // Verify encrypted fields exist
    expect(record?.encryptedKey).toBeTruthy();
    expect(record?.encryptedDataKey).toBeTruthy();
    expect(record?.iv).toBeTruthy();

    // Verify plaintext is NOT stored
    expect(record?.encryptedKey).not.toContain('sk-');

    // Decrypt and verify
    const decrypted = await manager.getApiKey(projectId);
    expect(decrypted).toBe(apiKey);
  });
});
```

**실행**:
```bash
bun test __tests__/integration/api-key-manager.test.ts
```

#### 3.3. Database Inspection

```sql
-- Connect to production database
SELECT
  id,
  project_id,
  LENGTH(encrypted_key) as encrypted_key_length,
  LENGTH(encrypted_data_key) as encrypted_data_key_length,
  LENGTH(iv) as iv_length,
  created_at
FROM api_keys
LIMIT 5;
```

**예상 결과**:
- `encrypted_key_length`: > 64 bytes (Base64 인코딩)
- `encrypted_data_key_length`: > 100 bytes
- `iv_length`: 24 bytes (Base64로 16 bytes IV 인코딩)
- Plaintext 노출 없음

### 검증 결과

| 테스트 | 결과 | 메모 |
|--------|------|------|
| Unit Test - Encrypt/Decrypt | ☐ 통과 ☐ 실패 | - |
| Unit Test - AES-256-GCM | ☐ 통과 ☐ 실패 | - |
| Integration Test - Save/Retrieve | ☐ 통과 ☐ 실패 | - |
| DB Inspection | ☐ 통과 ☐ 실패 | - |

**Overall**: ☐ 통과 ☐ 실패

---

## 4. bcrypt Password Hashing 검증

### 요구사항

- 사용자 비밀번호는 bcrypt로 해싱 (10 rounds)
- Plaintext 비밀번호는 DB에 저장되지 않음
- 비밀번호 강도 정책: 최소 8자, 특수문자 포함

### 검증 방법

#### 4.1. Unit Test - bcrypt Hashing

**파일**: `src/lib/auth/__tests__/password.test.ts`

```typescript
import bcrypt from 'bcrypt';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

describe('Password Hashing', () => {
  it('should hash password with bcrypt 10 rounds', async () => {
    const password = 'SecurePass123!';
    const hash = await hashPassword(password);

    // bcrypt hash starts with $2b$ (bcrypt identifier)
    expect(hash).toMatch(/^\$2b\$/);

    // bcrypt format: $2b$10$... (10 = rounds)
    expect(hash).toMatch(/^\$2b\$10\$/);

    // Verify hash length (60 chars for bcrypt)
    expect(hash).toHaveLength(60);
  });

  it('should verify correct password', async () => {
    const password = 'SecurePass123!';
    const hash = await hashPassword(password);

    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });

  it('should reject incorrect password', async () => {
    const password = 'SecurePass123!';
    const hash = await hashPassword(password);

    const isValid = await verifyPassword('WrongPassword', hash);
    expect(isValid).toBe(false);
  });
});
```

**실행**:
```bash
bun test src/lib/auth/__tests__/password.test.ts
```

#### 4.2. Integration Test - User Signup

```typescript
describe('User Signup', () => {
  it('should store hashed password in database', async () => {
    const email = 'test@example.com';
    const password = 'SecurePass123!';

    // Signup via API
    await api.auth.signup({ email, password });

    // Retrieve user from DB
    const user = await db.user.findUnique({ where: { email } });

    // Verify password is hashed
    expect(user?.passwordHash).toMatch(/^\$2b\$10\$/);
    expect(user?.passwordHash).not.toBe(password);
  });
});
```

#### 4.3. Database Inspection

```sql
SELECT
  id,
  email,
  LEFT(password_hash, 10) as hash_prefix,
  LENGTH(password_hash) as hash_length,
  created_at
FROM users
LIMIT 5;
```

**예상 결과**:
- `hash_prefix`: `$2b$10$...`
- `hash_length`: 60

### 검증 결과

| 테스트 | 결과 | 메모 |
|--------|------|------|
| Unit Test - bcrypt 10 rounds | ☐ 통과 ☐ 실패 | - |
| Unit Test - Verify Password | ☐ 통과 ☐ 실패 | - |
| Integration Test - Signup | ☐ 통과 ☐ 실패 | - |
| DB Inspection | ☐ 통과 ☐ 실패 | - |

**Overall**: ☐ 통과 ☐ 실패

---

## 5. NextAuth JWT Session Security 검증

### 요구사항

- JWT token은 httpOnly cookie로 저장
- Secure flag 활성화 (HTTPS only)
- Session 유효기간: 30일
- JWT secret은 환경 변수로 관리 (default secret 사용 금지)

### 검증 방법

#### 5.1. Cookie Flags 확인

**브라우저 개발자 도구** → Application → Cookies:

| 쿠키명 | httpOnly | Secure | SameSite | Max-Age |
|--------|----------|--------|----------|---------|
| next-auth.session-token | ✅ | ✅ | Lax | 2592000 (30일) |

#### 5.2. JWT Secret 검증

```bash
# Check environment variable
echo $NEXTAUTH_SECRET

# Should NOT be:
# - "secret" (default)
# - Empty
# - Less than 32 characters
```

**권장**: 32+ 자 무작위 문자열

```bash
# Generate secure secret
openssl rand -base64 32
```

#### 5.3. Integration Test - Session

```typescript
describe('NextAuth Session', () => {
  it('should create session with 30 days expiry', async () => {
    const { session, response } = await api.auth.login({
      email: 'test@example.com',
      password: 'SecurePass123!',
    });

    // Verify session expires in 30 days
    const expiresAt = new Date(session.expires);
    const now = new Date();
    const daysDiff = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

    expect(daysDiff).toBeCloseTo(30, 1);

    // Verify cookie flags
    const setCookie = response.headers.get('set-cookie');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('SameSite=Lax');
  });
});
```

#### 5.4. JWT Payload Inspection

```typescript
// Decode JWT (NOT verify, just inspect)
import jwt from 'jsonwebtoken';

const token = '[JWT token from cookie]';
const decoded = jwt.decode(token);

console.log(decoded);
// Should contain: { sub: userId, iat, exp, ... }
// Should NOT contain: password, apiKeys, sensitive data
```

### 검증 결과

| 테스트 | 결과 | 메모 |
|--------|------|------|
| Cookie httpOnly flag | ☐ 통과 ☐ 실패 | - |
| Cookie Secure flag | ☐ 통과 ☐ 실패 | - |
| Session 30-day expiry | ☐ 통과 ☐ 실패 | - |
| JWT Secret 강도 | ☐ 통과 ☐ 실패 | Length: _____ |
| JWT Payload 검증 | ☐ 통과 ☐ 실패 | - |

**Overall**: ☐ 통과 ☐ 실패

---

## 6. 추가 보안 검증

### 6.1. SQL Injection 방어

Prisma ORM 사용으로 자동 방어:
- Prepared statements
- Parameterized queries
- No raw SQL (except approved cases)

### 6.2. XSS 방어

React 기본 이스케이핑:
- `{variable}` 자동 이스케이프
- `dangerouslySetInnerHTML` 사용 금지 (audit 로그 확인)

```bash
# Search for dangerous patterns
git grep "dangerouslySetInnerHTML" src/
# Expected: No results (또는 approved cases only)
```

### 6.3. CSRF 방어

NextAuth 자동 CSRF 토큰:
- Form submissions에 `csrfToken` 포함
- State parameter in OAuth flows

### 6.4. Rate Limiting

Cron Jobs:
- Bearer token 인증 (CRON_SECRET)
- Vercel Cron (scheduled triggers only)

API Endpoints:
- Vercel Edge Network 자동 DDoS 방어
- tRPC middleware로 rate limiting 구현 (선택 사항)

### 검증 결과

| 항목 | 결과 | 메모 |
|------|------|------|
| SQL Injection 방어 | ☐ 통과 ☐ 실패 | - |
| XSS 방어 | ☐ 통과 ☐ 실패 | - |
| CSRF 방어 | ☐ 통과 ☐ 실패 | - |
| Rate Limiting | ☐ 통과 ☐ 실패 | - |

**Overall**: ☐ 통과 ☐ 실패

---

## 종합 검증 결과

| 보안 요구사항 | 결과 | 증빙 |
|-------------|------|------|
| NFR005: TLS 1.3 | ☐ 통과 ☐ 실패 | SSL Labs: _____ |
| Security Headers | ☐ 통과 ☐ 실패 | curl 출력 참조 |
| NFR004: AES-256 Encryption | ☐ 통과 ☐ 실패 | 테스트 통과 |
| bcrypt Password Hashing | ☐ 통과 ☐ 실패 | 10 rounds 확인 |
| NextAuth JWT Security | ☐ 통과 ☐ 실패 | httpOnly, Secure |

**AC #4: 모든 보안 요구사항 충족**: ☐ 예 ☐ 아니오

---

## 개선 권장 사항

1. **Content Security Policy (CSP) 강화**
   - 현재: (검증 필요)
   - 권장: `default-src 'self'; script-src 'self' 'unsafe-inline' trusted-cdn.com; ...`

2. **Subresource Integrity (SRI)**
   - 외부 스크립트에 SRI 해시 추가

3. **API Rate Limiting**
   - tRPC middleware 구현
   - 사용자당 시간당 요청 수 제한

4. **Security Audit**
   - 주기적인 의존성 취약점 스캔 (bun audit)
   - Snyk 또는 Dependabot 통합

---

**검증자 서명**: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
**검증 날짜**: \_\_\_\_/\_\_\_\_/\_\_\_\_

**리뷰어 서명**: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
**리뷰 날짜**: \_\_\_\_/\_\_\_\_/\_\_\_\_
