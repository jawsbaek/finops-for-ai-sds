/**
 * Provider-specific project ID format validation
 */

const PROJECT_ID_PATTERNS: Record<string, RegExp> = {
	openai: /^proj_[a-zA-Z0-9_-]+$/,
	anthropic: /^(workspace_|ws_)[a-zA-Z0-9_-]+$/,
	aws: /^[a-zA-Z0-9_-]+$/,
	azure: /^[a-zA-Z0-9_-]+$/,
};

/**
 * Validate project ID format for a given provider
 *
 * @param provider - AI provider name
 * @param projectId - Project identifier to validate
 * @returns true if format is valid, false otherwise
 */
export function validateProviderProjectIdFormat(
	provider: string,
	projectId: string,
): boolean {
	const pattern = PROJECT_ID_PATTERNS[provider];
	if (!pattern) {
		return false;
	}
	return pattern.test(projectId);
}

/**
 * Validation result with optional error message
 */
export interface ValidationResult {
	valid: boolean;
	error?: string;
}

/**
 * Validate project ID with real-time API check
 *
 * Routes to provider-specific validators
 */
export async function validateProviderProjectId(
	provider: string,
	adminApiKey: string,
	organizationId: string,
	projectId: string,
): Promise<ValidationResult> {
	// Provider-specific validation will be implemented in separate modules
	switch (provider) {
		case "openai": {
			const { validateOpenAIProjectId } = await import("./openai-validator");
			return validateOpenAIProjectId(adminApiKey, projectId);
		}
		case "anthropic":
			// TODO: Implement Anthropic validation
			return {
				valid: false,
				error:
					"Anthropic validation not yet implemented. Please contact support to enable this provider.",
			};
		case "aws":
			// TODO: Implement AWS validation
			return {
				valid: false,
				error:
					"AWS validation not yet implemented. Please contact support to enable this provider.",
			};
		case "azure":
			// TODO: Implement Azure validation
			return {
				valid: false,
				error:
					"Azure validation not yet implemented. Please contact support to enable this provider.",
			};
		default:
			return { valid: false, error: "Unsupported provider" };
	}
}
