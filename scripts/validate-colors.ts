#!/usr/bin/env bun

/**
 * Color System Validation Script
 *
 * Detects direct usage of Tailwind default color palette in className attributes.
 * This enforces the use of CSS custom properties defined in our design system.
 *
 * Usage:
 *   bun run scripts/validate-colors.ts
 *   npm run validate:colors
 */

import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

// Color patterns that should NOT be used directly
const FORBIDDEN_PATTERNS = [
	// Gray palette - use semantic colors instead
	/text-gray-\d+/g,
	/bg-gray-\d+/g,
	/border-gray-\d+/g,
	/from-gray-\d+/g,
	/to-gray-\d+/g,
	/via-gray-\d+/g,

	// Blue palette - use info semantic color
	/text-blue-\d+/g,
	/bg-blue-\d+/g,
	/border-blue-\d+/g,

	// Green palette - use success semantic color
	/text-green-\d+/g,
	/bg-green-\d+/g,
	/border-green-\d+/g,

	// Red palette - use error semantic color
	/text-red-\d+/g,
	/bg-red-\d+/g,
	/border-red-\d+/g,

	// Yellow/Orange palette - use warning semantic color
	/text-yellow-\d+/g,
	/bg-yellow-\d+/g,
	/border-yellow-\d+/g,
	/text-orange-\d+/g,
	/bg-orange-\d+/g,
	/border-orange-\d+/g,

	// Other common palettes
	/text-slate-\d+/g,
	/bg-slate-\d+/g,
	/border-slate-\d+/g,
	/text-zinc-\d+/g,
	/bg-zinc-\d+/g,
	/border-zinc-\d+/g,
	/text-neutral-\d+/g,
	/bg-neutral-\d+/g,
	/border-neutral-\d+/g,
	/text-stone-\d+/g,
	/bg-stone-\d+/g,
	/border-stone-\d+/g,
];

// Suggested replacements for common patterns
const SUGGESTIONS: Record<string, string[]> = {
	"text-gray-900": ["text-foreground"],
	"text-gray-800": ["text-foreground"],
	"text-gray-700": ["text-foreground"],
	"text-gray-600": ["text-muted-foreground"],
	"text-gray-500": ["text-muted-foreground"],
	"text-gray-400": ["text-muted-foreground"],
	"text-gray-300": ["text-muted-foreground"],

	"bg-gray-50": ["bg-muted", "bg-card"],
	"bg-gray-100": ["bg-muted", "bg-card"],
	"bg-gray-200": ["bg-muted"],
	"bg-gray-800": ["bg-card"],
	"bg-gray-900": ["bg-background"],

	"border-gray-200": ["border-border"],
	"border-gray-300": ["border-border"],
	"border-gray-400": ["border-border"],

	"text-blue-400": ["text-info"],
	"text-blue-500": ["text-info"],
	"text-blue-600": ["text-info"],
	"text-blue-700": ["text-info"],
	"bg-blue-50": ["bg-info/10"],
	"bg-blue-100": ["bg-info/10"],
	"border-blue-500": ["border-info"],

	"text-green-500": ["text-success"],
	"text-green-600": ["text-success"],
	"bg-green-50": ["bg-success/10"],
	"border-green-500": ["border-success"],

	"text-red-500": ["text-error"],
	"text-red-600": ["text-error"],
	"bg-red-50": ["bg-error/10"],
	"border-red-500": ["border-error"],

	"text-yellow-500": ["text-warning"],
	"text-yellow-600": ["text-warning"],
	"text-orange-500": ["text-warning"],
	"bg-yellow-50": ["bg-warning/10"],
	"bg-orange-50": ["bg-warning/10"],
	"border-yellow-500": ["border-warning"],
};

interface Violation {
	file: string;
	line: number;
	column: number;
	match: string;
	context: string;
	suggestions?: string[];
}

const violations: Violation[] = [];

/**
 * Check if a line contains an escape comment
 */
function hasEscapeComment(line: string): boolean {
	return (
		/\/\/\s*eslint-disable.*validate-colors/.test(line) ||
		/\/\*\s*eslint-disable.*validate-colors/.test(line)
	);
}

/**
 * Scan a file for forbidden color patterns
 */
async function scanFile(filePath: string): Promise<void> {
	const content = await readFile(filePath, "utf-8");
	const lines = content.split("\n");

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (!line) continue;

		// Skip if escape comment is present
		if (hasEscapeComment(line)) {
			continue;
		}

		// Check for className or class attributes
		const classNameMatch =
			/className=["'`]([^"'`]*)["'`]/.exec(line) ||
			/class=["'`]([^"'`]*)["'`]/.exec(line);

		if (!classNameMatch || !classNameMatch[1]) continue;

		const classNames = classNameMatch[1];

		// Check against all forbidden patterns
		for (const pattern of FORBIDDEN_PATTERNS) {
			const matches = classNames.matchAll(pattern);

			for (const match of matches) {
				const matchStr = match[0];
				const column = (classNameMatch.index ?? 0) + (match.index ?? 0);

				violations.push({
					file: filePath,
					line: i + 1,
					column,
					match: matchStr,
					context: line.trim(),
					suggestions: SUGGESTIONS[matchStr],
				});
			}
		}
	}
}

/**
 * Recursively scan directory for TypeScript/JavaScript/TSX/JSX files
 */
async function scanDirectory(dir: string): Promise<void> {
	const entries = await readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = join(dir, entry.name);

		// Skip node_modules, .next, .git, etc.
		if (
			entry.name === "node_modules" ||
			entry.name === ".next" ||
			entry.name === ".git" ||
			entry.name === "dist" ||
			entry.name === "build"
		) {
			continue;
		}

		if (entry.isDirectory()) {
			await scanDirectory(fullPath);
		} else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
			await scanFile(fullPath);
		}
	}
}

/**
 * Format and print violations
 */
function printViolations(): void {
	if (violations.length === 0) {
		console.log("✅ No color system violations found!");
		return;
	}

	console.log(`\n❌ Found ${violations.length} color system violation(s):\n`);

	const violationsByFile = new Map<string, Violation[]>();

	for (const violation of violations) {
		const existing = violationsByFile.get(violation.file) ?? [];
		existing.push(violation);
		violationsByFile.set(violation.file, existing);
	}

	const rootDir = process.cwd();

	for (const [file, fileViolations] of violationsByFile) {
		const relPath = relative(rootDir, file);
		console.log(`\n📄 ${relPath}`);

		for (const v of fileViolations) {
			console.log(`  ${v.line}:${v.column} - Found "${v.match}"`);
			console.log(`    ${v.context}`);

			if (v.suggestions && v.suggestions.length > 0) {
				console.log(`    💡 Suggestion: Use ${v.suggestions.join(" or ")}`);
			} else {
				console.log(
					"    💡 See docs/color-system-guidelines.md for alternatives",
				);
			}
		}
	}

	console.log("\n📚 Documentation: docs/color-system-guidelines.md");
	console.log(
		"\n❌ Color validation failed. Please fix the violations above.\n",
	);
}

/**
 * Main execution
 */
async function main(): Promise<void> {
	const startTime = Date.now();

	console.log("🎨 Validating color system usage...\n");

	// Scan src directory
	const srcDir = join(process.cwd(), "src");
	await scanDirectory(srcDir);

	const elapsed = Date.now() - startTime;

	printViolations();

	console.log(`\n⏱️  Completed in ${elapsed}ms`);

	// Exit with error code if violations found
	if (violations.length > 0) {
		process.exit(1);
	}
}

// Run the script
main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
