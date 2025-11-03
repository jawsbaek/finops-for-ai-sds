/**
 * Input Sanitization Utility
 *
 * Removes all HTML tags and potential XSS vectors from user input
 * Used for sanitizing user-provided text like reasons, project names, etc.
 */

import { decode } from "he";
import sanitizeHtml from "sanitize-html";

/**
 * Sanitize user input by removing all HTML tags and trimming whitespace
 *
 * @param input - The user input string to sanitize
 * @returns Sanitized string with all HTML removed and whitespace trimmed
 *
 * @example
 * ```ts
 * sanitizeInput('<script>alert("xss")</script>Hello')
 * // Returns: 'Hello'
 *
 * sanitizeInput('  Valid text  ')
 * // Returns: 'Valid text'
 * ```
 */
export function sanitizeInput(input: string): string {
	// Step 1: Decode HTML entities first (e.g., &lt;script&gt; -> <script>)
	// This prevents encoded XSS attacks from bypassing sanitization
	const decoded = decode(input);

	// Step 2: Remove all HTML tags (including previously encoded ones)
	const withoutTags = sanitizeHtml(decoded, {
		allowedTags: [], // No HTML tags allowed
		allowedAttributes: {}, // No attributes allowed
		// Default disallowedTagsMode is "discard" which removes tags and keeps text content
	});

	// Step 3: Decode again to convert &amp; back to & (sanitize-html encodes special chars)
	// This ensures we store plain text, not HTML-encoded text
	const plainText = decode(withoutTags);

	// Step 4: Trim whitespace
	return plainText.trim();
}
