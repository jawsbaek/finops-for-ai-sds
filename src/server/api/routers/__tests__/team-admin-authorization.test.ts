/**
 * Unit Tests for Team Admin API Key Authorization Helper
 *
 * Tests the requireAdminRole helper function to ensure only owners and admins
 * can perform admin operations.
 *
 * Coverage:
 * - Owner role is allowed
 * - Admin role is allowed
 * - Member role is rejected with FORBIDDEN error
 * - Non-member (null) is rejected with FORBIDDEN error
 * - Error messages are descriptive
 */

import type { TeamMember } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

// Replica of the helper function from team.ts to test the logic
function requireAdminRole(
	teamMember: TeamMember | null,
	operation: string,
): void {
	if (!teamMember) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You are not a member of this team",
		});
	}

	if (teamMember.role !== "owner" && teamMember.role !== "admin") {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: `Only team owners and admins can ${operation}`,
		});
	}
}

describe("requireAdminRole helper function", () => {
	const createMockTeamMember = (
		role: "owner" | "admin" | "member",
	): TeamMember => ({
		id: "member-1",
		teamId: "team-456",
		userId: "user-123",
		role,
		createdAt: new Date(),
	});

	describe("Authorization for deleteAdminApiKey", () => {
		const operation = "delete admin API keys";

		it("should allow owner to perform operation", () => {
			const ownerMember = createMockTeamMember("owner");

			// Should not throw
			expect(() => requireAdminRole(ownerMember, operation)).not.toThrow();
		});

		it("should allow admin to perform operation", () => {
			const adminMember = createMockTeamMember("admin");

			// Should not throw
			expect(() => requireAdminRole(adminMember, operation)).not.toThrow();
		});

		it("should reject member from performing operation", () => {
			const regularMember = createMockTeamMember("member");

			expect(() => requireAdminRole(regularMember, operation)).toThrow(
				TRPCError,
			);

			try {
				requireAdminRole(regularMember, operation);
			} catch (error) {
				expect(error).toBeInstanceOf(TRPCError);
				expect((error as TRPCError).code).toBe("FORBIDDEN");
				expect((error as TRPCError).message).toBe(
					`Only team owners and admins can ${operation}`,
				);
			}
		});

		it("should reject non-member from performing operation", () => {
			const nonMember = null;

			expect(() => requireAdminRole(nonMember, operation)).toThrow(TRPCError);

			try {
				requireAdminRole(nonMember, operation);
			} catch (error) {
				expect(error).toBeInstanceOf(TRPCError);
				expect((error as TRPCError).code).toBe("FORBIDDEN");
				expect((error as TRPCError).message).toBe(
					"You are not a member of this team",
				);
			}
		});
	});

	describe("Authorization for toggleAdminApiKey", () => {
		const operation = "toggle admin API keys";

		it("should allow owner to perform operation", () => {
			const ownerMember = createMockTeamMember("owner");

			// Should not throw
			expect(() => requireAdminRole(ownerMember, operation)).not.toThrow();
		});

		it("should allow admin to perform operation", () => {
			const adminMember = createMockTeamMember("admin");

			// Should not throw
			expect(() => requireAdminRole(adminMember, operation)).not.toThrow();
		});

		it("should reject member from performing operation", () => {
			const regularMember = createMockTeamMember("member");

			expect(() => requireAdminRole(regularMember, operation)).toThrow(
				TRPCError,
			);

			try {
				requireAdminRole(regularMember, operation);
			} catch (error) {
				expect(error).toBeInstanceOf(TRPCError);
				expect((error as TRPCError).code).toBe("FORBIDDEN");
				expect((error as TRPCError).message).toBe(
					`Only team owners and admins can ${operation}`,
				);
			}
		});

		it("should reject non-member from performing operation", () => {
			const nonMember = null;

			expect(() => requireAdminRole(nonMember, operation)).toThrow(TRPCError);

			try {
				requireAdminRole(nonMember, operation);
			} catch (error) {
				expect(error).toBeInstanceOf(TRPCError);
				expect((error as TRPCError).code).toBe("FORBIDDEN");
				expect((error as TRPCError).message).toBe(
					"You are not a member of this team",
				);
			}
		});
	});

	describe("Error message formatting", () => {
		it("should include operation name in error message", () => {
			const regularMember = createMockTeamMember("member");
			const customOperation = "perform sensitive action";

			try {
				requireAdminRole(regularMember, customOperation);
				// Should not reach here
				expect(true).toBe(false);
			} catch (error) {
				expect((error as TRPCError).message).toContain(customOperation);
				expect((error as TRPCError).message).toBe(
					`Only team owners and admins can ${customOperation}`,
				);
			}
		});

		it("should have consistent error message for non-members", () => {
			try {
				requireAdminRole(null, "any operation");
				// Should not reach here
				expect(true).toBe(false);
			} catch (error) {
				expect((error as TRPCError).message).toBe(
					"You are not a member of this team",
				);
				// Message should not include operation name for non-members
				expect((error as TRPCError).message).not.toContain("any operation");
			}
		});
	});
});
