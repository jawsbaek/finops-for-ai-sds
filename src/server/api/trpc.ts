/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */

import { TRPCError, initTRPC } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { getServerTranslations } from "~/lib/i18n";
import { logger } from "~/lib/logger";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { verifyCaptchaToken } from "./captcha";
import { rateLimits } from "./ratelimit";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
	const session = await auth();

	return {
		db,
		session,
		...opts,
	};
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
	transformer: superjson,
	errorFormatter({ shape, error }) {
		return {
			...shape,
			data: {
				...shape.data,
				zodError:
					error.cause instanceof ZodError ? error.cause.flatten() : null,
			},
		};
	},
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Middleware for timing procedure execution and adding an artificial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
	const start = Date.now();

	if (t._config.isDev) {
		// artificial delay in dev
		const waitMs = Math.floor(Math.random() * 400) + 100;
		await new Promise((resolve) => setTimeout(resolve, waitMs));
	}

	const result = await next();

	const end = Date.now();
	console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

	return result;
});

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure.use(timingMiddleware);

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = t.procedure
	.use(timingMiddleware)
	.use(({ ctx, next }) => {
		if (!ctx.session?.user) {
			throw new TRPCError({ code: "UNAUTHORIZED" });
		}
		return next({
			ctx: {
				// infers the `session` as non-nullable
				session: { ...ctx.session, user: ctx.session.user },
			},
		});
	});

/**
 * Rate limiting middleware factory
 *
 * Creates a middleware that applies rate limiting based on user ID or IP address
 * @param type - 'sensitive' for strict limits (10/min) or 'normal' for regular limits (100/min)
 *
 * Note: This middleware is designed to be used AFTER protectedProcedure,
 * so ctx.session.user is guaranteed to exist
 */
const rateLimitMiddleware = (type: "sensitive" | "normal") =>
	t.middleware(async ({ ctx, next }) => {
		// After protectedProcedure, session.user is guaranteed to exist
		// Fallback to 'anonymous' for type safety (should never happen in practice)
		const identifier = ctx.session?.user?.id ?? "anonymous";

		const { success, limit, remaining, reset } =
			await rateLimits[type].limit(identifier);

		if (!success) {
			const retryAfterSeconds = Math.ceil((reset - Date.now()) / 1000);

			// Log rate limit violation for security monitoring
			logger.warn(
				{
					identifier,
					limitType: type,
					limit,
					retryAfterSeconds,
				},
				"Rate limit exceeded",
			);

			throw new TRPCError({
				code: "TOO_MANY_REQUESTS",
				message: `Rate limit exceeded. Please try again in ${retryAfterSeconds} seconds.`,
			});
		}

		return next({
			ctx: {
				...ctx,
				rateLimit: { limit, remaining, reset },
			},
		});
	});

/**
 * Sensitive procedure with strict rate limiting (10 requests/min)
 *
 * Use for operations like:
 * - API key generation/deletion
 * - Member management
 * - Other security-sensitive mutations
 */
export const sensitiveProcedure = protectedProcedure.use(
	rateLimitMiddleware("sensitive"),
);

/**
 * Normal procedure with regular rate limiting (100 requests/min)
 *
 * Use for standard queries and mutations
 */
export const normalProcedure = protectedProcedure.use(
	rateLimitMiddleware("normal"),
);

/**
 * CAPTCHA verification middleware
 *
 * Validates Cap.js proof-of-work token from client
 * Extracts captchaToken from input and validates it
 * Note: captchaToken will be removed by the procedure's zod schema
 */
const captchaMiddleware = t.middleware(async ({ ctx, next, getRawInput }) => {
	const t = getServerTranslations();

	// Get raw input from the request
	const rawInput = await getRawInput();
	const input = rawInput as { captchaToken?: string };

	if (!input?.captchaToken) {
		logger.warn(
			{
				userId: ctx.session?.user?.id,
			},
			"CAPTCHA token missing from request",
		);

		throw new TRPCError({
			code: "BAD_REQUEST",
			message: t.captcha.tokenRequired,
		});
	}

	// Verify token
	const isValid = await verifyCaptchaToken(input.captchaToken);

	if (!isValid) {
		logger.warn(
			{
				userId: ctx.session?.user?.id,
				tokenPrefix: input.captchaToken.slice(0, 10),
			},
			"CAPTCHA verification failed",
		);

		throw new TRPCError({
			code: "FORBIDDEN",
			message: t.captcha.verificationFailed,
		});
	}

	logger.info(
		{
			userId: ctx.session?.user?.id,
		},
		"CAPTCHA verification successful",
	);

	return next({
		ctx,
	});
});

/**
 * Public CAPTCHA procedure (for unauthenticated operations like login/signup)
 *
 * Applies CAPTCHA verification without authentication requirement
 * Use for:
 * - Login
 * - Signup
 * - Password reset
 */
export const publicCaptchaProcedure = publicProcedure.use(captchaMiddleware);

/**
 * CAPTCHA-protected procedure (for authenticated operations)
 *
 * Combines protection, rate limiting, and CAPTCHA verification
 * Use for highly sensitive operations:
 * - API key management (create, delete, toggle)
 * - Critical admin operations
 * - Sensitive member management
 *
 * Order of middleware execution:
 * 1. protectedProcedure (auth check)
 * 2. rateLimitMiddleware (rate limit)
 * 3. captchaMiddleware (CAPTCHA verification)
 */
export const captchaProcedure = protectedProcedure
	.use(rateLimitMiddleware("sensitive"))
	.use(captchaMiddleware);
