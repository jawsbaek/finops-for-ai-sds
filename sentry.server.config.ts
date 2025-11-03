import * as Sentry from "@sentry/nextjs";

Sentry.init({
	dsn: process.env.SENTRY_DSN,

	// Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
	// We recommend adjusting this value in production, or using tracesSampler for finer control.
	tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

	// Setting this option to true will print useful information to the console while you're setting up Sentry.
	debug: false,

	// Capture 100% of errors in production
	beforeSend(event) {
		// Don't send events for 4xx client errors
		if (
			event.exception?.values?.some(
				(exception) =>
					exception.value?.includes("4") && exception.type?.includes("HTTP"),
			)
		) {
			return null;
		}
		return event;
	},

	// Environment
	environment: process.env.NODE_ENV || "development",

	// Release tracking
	release: process.env.VERCEL_GIT_COMMIT_SHA,

	// Server-specific integrations
	integrations: [
		// Add performance monitoring for HTTP requests
		Sentry.httpIntegration({
			// Optional: Filter requests
			tracing: {
				shouldCreateSpanForRequest: (url) => {
					// Don't create spans for health checks
					return !url.includes("/health") && !url.includes("/api/health");
				},
			},
		}),
	],
});
