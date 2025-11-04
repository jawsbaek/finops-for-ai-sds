import { auth } from "~/server/auth";

/**
 * Centralized authentication middleware for Next.js
 *
 * Protects all routes except public ones (landing, login, signup)
 * Redirects authenticated users away from auth pages
 * Provides callback URL support for post-login redirects
 */
export default auth((req) => {
	const { pathname } = req.nextUrl;

	// Public routes that don't require authentication
	const publicRoutes = ["/", "/login", "/signup"];
	const isPublicRoute = publicRoutes.some((route) =>
		pathname === route ? true : pathname.startsWith(`${route}/`),
	);

	// API routes for tRPC - handled by tRPC middleware
	if (pathname.startsWith("/api/trpc")) {
		return;
	}

	// NextAuth API routes - always public
	if (pathname.startsWith("/api/auth")) {
		return;
	}

	const isAuthenticated = !!req.auth;

	// Redirect unauthenticated users to login (except on public routes)
	if (!isPublicRoute && !isAuthenticated) {
		const loginUrl = new URL("/login", req.url);
		loginUrl.searchParams.set("callbackUrl", pathname);
		return Response.redirect(loginUrl);
	}

	// Redirect authenticated users away from auth pages
	if (isAuthenticated && (pathname === "/login" || pathname === "/signup")) {
		return Response.redirect(new URL("/dashboard", req.url));
	}
});

export const config = {
	matcher: [
		/*
		 * Match all request paths except:
		 * - _next/static (static files)
		 * - _next/image (image optimization)
		 * - favicon.ico (favicon file)
		 * - public files (images, fonts, etc.)
		 */
		"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
	],
};
