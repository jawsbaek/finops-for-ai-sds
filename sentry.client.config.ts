import * as Sentry from "@sentry/nextjs";

Sentry.init({
	dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

	// Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
	// We recommend adjusting this value in production, or using tracesSampler for finer control.
	tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

	// Setting this option to true will print useful information to the console while you're setting up Sentry.
	debug: false,

	// You can remove this option if you're not planning to use the Sentry Session Replay feature:
	replaysOnErrorSampleRate: 1.0,

	// If the entire session is not sampled, use the below sample rate to sample
	// sessions when an error occurs.
	replaysSessionSampleRate: 0.1,

	// Capture 100% of errors in production
	beforeSend(event) {
		// Filter out non-error events if needed
		return event;
	},

	// Integration setup
	integrations: [
		Sentry.replayIntegration({
			// Additional SDK configuration goes in here, for example:
			maskAllText: true,
			blockAllMedia: true,
		}),
	],

	// Environment
	environment: process.env.NODE_ENV || "development",

	// Release tracking
	release: process.env.VERCEL_GIT_COMMIT_SHA,
});
