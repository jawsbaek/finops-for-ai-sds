/**
 * Shared logger instance using Pino
 */

import pino from "pino";

export const logger = pino({
	name: "finops-for-ai",
	level: process.env.LOG_LEVEL ?? "info",
});
