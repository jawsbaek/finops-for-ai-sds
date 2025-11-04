# Authentication System - Future Improvements

This document outlines recommended enhancements to the authentication system that can be implemented in future iterations.

## Current Status

All critical security issues have been resolved:
- ✅ Database session strategy with immediate invalidation
- ✅ Login attempt rate limiting (5 attempts per 15 minutes)
- ✅ Password change with session invalidation
- ✅ Centralized route protection with middleware
- ✅ Secure cookie configuration

## Recommended Future Enhancements

### Priority 1: Session Cleanup (Recommended)

**Problem:** Expired sessions accumulate in the database over time, consuming storage.

**Solution:** Implement automated session cleanup via cron job.

**Implementation:**
```typescript
// src/app/api/cron/cleanup-sessions/route.ts
import { db } from "~/server/db";

export async function GET() {
  // Delete sessions expired more than 7 days ago
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const result = await db.session.deleteMany({
    where: {
      expires: {
        lt: sevenDaysAgo,
      },
    },
  });

  return Response.json({
    success: true,
    deletedCount: result.count,
  });
}
```

**Vercel Cron Configuration:**
```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/cleanup-sessions",
      "schedule": "0 2 * * *"  // Daily at 2 AM
    }
  ]
}
```

**Benefits:**
- Reduces database storage costs
- Improves query performance
- Maintains system hygiene

**Effort:** Low (1-2 hours)

---

### Priority 2: Email Verification (Optional)

**Problem:** Users can sign up with invalid email addresses, leading to spam accounts and poor data quality.

**Solution:** Implement email verification during signup.

**Implementation Steps:**

1. Add email verification fields to User model:
```prisma
model User {
  // ... existing fields ...
  emailVerified    DateTime? @map("email_verified")
  verificationToken String?   @unique @map("verification_token")
}
```

2. Send verification email on signup:
```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendVerificationEmail(email: string, token: string) {
  await resend.emails.send({
    from: 'noreply@finops-for-ai.com',
    to: email,
    subject: 'Verify your email',
    html: `
      <p>Click the link below to verify your email:</p>
      <a href="${process.env.NEXTAUTH_URL}/verify-email?token=${token}">
        Verify Email
      </a>
    `,
  });
}
```

3. Add verification route:
```typescript
// src/app/verify-email/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  const user = await db.user.update({
    where: { verificationToken: token },
    data: {
      emailVerified: new Date(),
      verificationToken: null,
    },
  });

  // Redirect to login with success message
  return redirect('/login?verified=true');
}
```

4. Restrict unverified users:
```typescript
// In auth config
async authorize(credentials) {
  // ... existing password verification ...

  if (!user.emailVerified) {
    throw new Error("Please verify your email before logging in");
  }

  return user;
}
```

**Benefits:**
- Reduces spam accounts
- Improves data quality
- Enables password reset functionality

**Effort:** Medium (4-6 hours)

**Dependencies:**
- Email service (Resend, SendGrid, etc.)
- `RESEND_API_KEY` environment variable

---

### Priority 3: Password Reset (Optional)

**Problem:** Users who forget their password have no way to recover access.

**Solution:** Implement password reset flow.

**Implementation Steps:**

1. Add password reset token to schema:
```prisma
model User {
  // ... existing fields ...
  resetToken       String?   @unique @map("reset_token")
  resetTokenExpiry DateTime? @map("reset_token_expiry")
}
```

2. Create forgot password endpoint:
```typescript
// auth.router.ts
forgotPassword: publicProcedure
  .input(z.object({ email: z.string().email() }))
  .mutation(async ({ input, ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      // Don't reveal if email exists (security)
      return { success: true };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await ctx.db.user.update({
      where: { id: user.id },
      data: {
        resetToken: token,
        resetTokenExpiry: expiry,
      },
    });

    await sendPasswordResetEmail(user.email, token);

    return { success: true };
  }),
```

3. Create reset password endpoint:
```typescript
resetPassword: publicProcedure
  .input(z.object({
    token: z.string(),
    newPassword: z.string().min(8),
  }))
  .mutation(async ({ input, ctx }) => {
    const user = await ctx.db.user.findFirst({
      where: {
        resetToken: input.token,
        resetTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid or expired reset token",
      });
    }

    const newHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);

    await ctx.db.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    // Invalidate all sessions for security
    await ctx.db.session.deleteMany({
      where: { userId: user.id },
    });

    return { success: true };
  }),
```

**Benefits:**
- Improved user experience
- Reduced support burden
- Essential for production apps

**Effort:** Medium (4-6 hours)

**Dependencies:**
- Email service
- Requires email verification to be implemented first

---

### Priority 4: Two-Factor Authentication (Optional)

**Problem:** Password-only authentication can be compromised through phishing or credential leaks.

**Solution:** Implement TOTP-based 2FA.

**Implementation Steps:**

1. Add 2FA fields to User model:
```prisma
model User {
  // ... existing fields ...
  twoFactorEnabled Boolean  @default(false) @map("two_factor_enabled")
  twoFactorSecret  String?  @map("two_factor_secret")
}
```

2. Install dependencies:
```bash
bun add otpauth qrcode
bun add -D @types/qrcode
```

3. Create 2FA setup endpoint:
```typescript
import { TOTP } from 'otpauth';
import QRCode from 'qrcode';

setup2FA: protectedProcedure.mutation(async ({ ctx }) => {
  const user = ctx.session.user;

  // Generate secret
  const totp = new TOTP({
    issuer: 'FinOps for AI',
    label: user.email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  });

  const secret = totp.secret.base32;

  // Generate QR code
  const qrCodeUrl = await QRCode.toDataURL(totp.toString());

  // Save secret (not enabled yet)
  await ctx.db.user.update({
    where: { id: user.id },
    data: { twoFactorSecret: secret },
  });

  return { secret, qrCodeUrl };
}),
```

4. Verify and enable 2FA:
```typescript
enable2FA: protectedProcedure
  .input(z.object({ code: z.string().length(6) }))
  .mutation(async ({ input, ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
    });

    if (!user?.twoFactorSecret) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "2FA not set up",
      });
    }

    const totp = new TOTP({ secret: user.twoFactorSecret });
    const isValid = totp.validate({ token: input.code }) !== null;

    if (!isValid) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid code",
      });
    }

    await ctx.db.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true },
    });

    return { success: true };
  }),
```

5. Update login flow to require 2FA code:
```typescript
// In authorize function
if (user.twoFactorEnabled) {
  // Store user ID in temporary session
  // Redirect to 2FA verification page
  // Only create full session after 2FA verification
}
```

**Benefits:**
- Significantly improved security
- Protection against credential theft
- Industry standard for sensitive applications

**Effort:** High (8-12 hours)

**Considerations:**
- Provide backup codes for account recovery
- Add "Trust this device" option
- UI/UX complexity increases

---

### Priority 5: Session Activity Log (Optional)

**Problem:** Users cannot see where they're logged in or detect suspicious activity.

**Solution:** Display active sessions and login history.

**Implementation Steps:**

1. Enhance Session model:
```prisma
model Session {
  // ... existing fields ...
  ipAddress  String?  @map("ip_address")
  userAgent  String?  @map("user_agent")
  location   String?  // Derived from IP (city, country)
  lastActive DateTime @default(now()) @map("last_active")
}
```

2. Capture session metadata in auth config:
```typescript
// In NextAuth callbacks
async session({ session, user, ...rest }) {
  // Update last active timestamp
  if (rest.trigger === "update") {
    await db.session.update({
      where: { sessionToken: rest.sessionToken },
      data: { lastActive: new Date() },
    });
  }

  return session;
}
```

3. Create sessions list endpoint:
```typescript
getActiveSessions: protectedProcedure.query(async ({ ctx }) => {
  const sessions = await ctx.db.session.findMany({
    where: {
      userId: ctx.session.user.id,
      expires: { gt: new Date() },
    },
    orderBy: { lastActive: 'desc' },
  });

  return sessions.map(s => ({
    id: s.id,
    ipAddress: s.ipAddress,
    userAgent: s.userAgent,
    location: s.location,
    lastActive: s.lastActive,
    isCurrent: s.sessionToken === ctx.session.sessionToken,
  }));
}),
```

4. Add revoke session endpoint:
```typescript
revokeSession: protectedProcedure
  .input(z.object({ sessionId: z.string() }))
  .mutation(async ({ input, ctx }) => {
    await ctx.db.session.delete({
      where: {
        id: input.sessionId,
        userId: ctx.session.user.id, // Ensure ownership
      },
    });

    return { success: true };
  }),
```

**Benefits:**
- Users can monitor their account security
- Detect and respond to suspicious logins
- Improved transparency

**Effort:** Medium (6-8 hours)

**Dependencies:**
- IP geolocation service (optional, for location data)

---

### Priority 6: Login Attempt Notifications (Optional)

**Problem:** Users are not notified when their account is under attack.

**Solution:** Send email notifications on suspicious login activity.

**Implementation:**

```typescript
// In auth config, after detecting failed attempts
if (recentFailedAttempts >= 3) {
  await sendSecurityAlert(email, {
    type: 'multiple_failed_logins',
    count: recentFailedAttempts,
    timestamp: new Date(),
  });
}

// On successful login from new IP/device
if (isNewDevice(user.id, ipAddress, userAgent)) {
  await sendSecurityAlert(user.email, {
    type: 'new_device_login',
    ipAddress,
    userAgent,
    location: getLocationFromIP(ipAddress),
  });
}
```

**Benefits:**
- Early detection of account compromise
- User awareness of security events
- Improved trust

**Effort:** Low (2-4 hours)

**Dependencies:**
- Email service
- IP geolocation service (optional)

---

## Implementation Priority

Based on impact vs. effort:

1. **Session Cleanup** - Quick win, prevents technical debt
2. **Email Verification** - Essential for production, enables password reset
3. **Password Reset** - High user value, relatively low effort
4. **Session Activity Log** - Good security feature, moderate effort
5. **Two-Factor Authentication** - High security value, high effort
6. **Login Notifications** - Nice to have, low effort

## Cost Considerations

- **Email Service:** ~$10-20/month (Resend, SendGrid)
  - 10,000 emails/month typically sufficient for early stage
- **IP Geolocation:** Free tier available (ipapi.com)
  - 1,000 requests/day on free plan
- **Database Storage:** Negligible increase
  - Sessions: ~200 bytes per session
  - Login attempts: ~100 bytes per attempt

## Testing Checklist

When implementing these features, ensure:

- [ ] Unit tests for all new endpoints
- [ ] Integration tests for complete flows
- [ ] Security testing (rate limiting, token expiry)
- [ ] Email delivery testing (use preview mode in dev)
- [ ] Mobile responsive UI testing
- [ ] Browser compatibility testing
- [ ] Load testing for cron jobs

## Documentation Requirements

Each implemented feature should include:

1. User-facing documentation (how to use)
2. Developer documentation (how it works)
3. API documentation (tRPC procedures)
4. Security considerations
5. Troubleshooting guide

---

**Last Updated:** 2025-01-04
**Maintainer:** Development Team
**Status:** Living Document
