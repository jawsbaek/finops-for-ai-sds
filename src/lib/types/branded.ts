/**
 * Branded Types for Enhanced Type Safety
 *
 * Prevents mixing different ID types (e.g., projectId vs teamId)
 * Zero runtime overhead - purely compile-time safety
 *
 * @example
 * ```typescript
 * function getProject(id: ProjectId) { ... }
 * const teamId: TeamId = "team-123" as TeamId;
 * getProject(teamId); // TypeScript Error: Argument of type 'TeamId' is not assignable to 'ProjectId'
 * ```
 */

/**
 * Brand utility type
 * Creates a nominal type from a primitive type
 */
type Brand<T, B> = T & { readonly __brand: B };

/**
 * Project ID - uniquely identifies a project
 */
export type ProjectId = Brand<string, "ProjectId">;

/**
 * Team ID - uniquely identifies a team
 */
export type TeamId = Brand<string, "TeamId">;

/**
 * User ID - uniquely identifies a user
 */
export type UserId = Brand<string, "UserId">;

/**
 * API Key ID - uniquely identifies an API key
 */
export type ApiKeyId = Brand<string, "ApiKeyId">;

/**
 * Alert ID - uniquely identifies a cost alert
 */
export type AlertId = Brand<string, "AlertId">;

/**
 * Cost Data ID - uniquely identifies a cost data record
 */
export type CostDataId = Brand<string, "CostDataId">;

/**
 * Helper function to create a branded ID
 * Use when converting from external sources or database
 *
 * @example
 * ```typescript
 * const projectId = brandId<ProjectId>(dbRecord.id);
 * ```
 */
export function brandId<T extends Brand<string, string>>(id: string): T {
	return id as T;
}

/**
 * Helper function to unbrand an ID back to string
 * Use when passing to external APIs that expect plain strings
 *
 * @example
 * ```typescript
 * const plainString = unbrandId(projectId);
 * ```
 */
export function unbrandId<T extends Brand<string, string>>(id: T): string {
	return id as string;
}
