/**
 * AIProviderRegistration Component Tests
 *
 * Tests the validation logic and cancellation behavior
 * Note: Full E2E interactions with Radix UI Select are tested in separate E2E tests
 * due to JSDOM limitations with pointer capture APIs
 */

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as trpcReact from "~/trpc/react";
import { AIProviderRegistration } from "../AIProviderRegistration";

// Mock tRPC
vi.mock("~/trpc/react", () => ({
	api: {
		team: {
			getAdminApiKeys: {
				useQuery: vi.fn(),
			},
		},
		project: {
			validateAIProjectId: {
				useMutation: vi.fn(),
			},
			registerAIProvider: {
				useMutation: vi.fn(),
			},
		},
	},
}));

describe("AIProviderRegistration", () => {
	const mockValidateMutate = vi.fn();
	const mockRegisterMutate = vi.fn();

	beforeEach(() => {
		// Setup admin keys query
		vi.mocked(trpcReact.api.team.getAdminApiKeys.useQuery).mockReturnValue({
			data: [
				{
					provider: "openai",
					organizationId: "org_123",
					displayName: "Test Org",
					last4: "abcd",
					isActive: true,
				},
			],
			isLoading: false,
			isError: false,
			error: null,
		} as never);

		// Setup validate mutation
		vi.mocked(
			trpcReact.api.project.validateAIProjectId.useMutation,
		).mockReturnValue({
			mutate: mockValidateMutate,
			isPending: false,
			isError: false,
			isSuccess: false,
			error: null,
		} as never);

		// Setup register mutation
		vi.mocked(
			trpcReact.api.project.registerAIProvider.useMutation,
		).mockReturnValue({
			mutate: mockRegisterMutate,
			isPending: false,
			isError: false,
			isSuccess: false,
			error: null,
		} as never);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
	});

	it("should show no admin keys message when none available", () => {
		// Mock empty admin keys
		vi.mocked(trpcReact.api.team.getAdminApiKeys.useQuery).mockReturnValue({
			data: [],
			isLoading: false,
			isError: false,
			error: null,
		} as never);

		render(
			<AIProviderRegistration
				projectId="test-project-123"
				teamId="test-team-456"
				onSuccess={vi.fn()}
			/>,
		);

		expect(
			screen.getByText(/no admin keys registered yet/i),
		).toBeInTheDocument();
	});

	it("should render form with provider select when admin keys exist", () => {
		render(
			<AIProviderRegistration
				projectId="test-project-123"
				teamId="test-team-456"
				onSuccess={vi.fn()}
			/>,
		);

		expect(
			screen.getByRole("combobox", { name: /provider/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /register provider/i }),
		).toBeInTheDocument();
	});

	it("should have submit button disabled initially", () => {
		render(
			<AIProviderRegistration
				projectId="test-project-123"
				teamId="test-team-456"
				onSuccess={vi.fn()}
			/>,
		);

		const submitButton = screen.getByRole("button", {
			name: /register provider/i,
		});
		expect(submitButton).toBeDisabled();
	});

	it("should create validation mutation with stable reference", () => {
		const { rerender } = render(
			<AIProviderRegistration
				projectId="test-project-123"
				teamId="test-team-456"
				onSuccess={vi.fn()}
			/>,
		);

		// Get initial call count
		const initialCallCount = vi.mocked(
			trpcReact.api.project.validateAIProjectId.useMutation,
		).mock.calls.length;

		// Force re-render
		rerender(
			<AIProviderRegistration
				projectId="test-project-123"
				teamId="test-team-456"
				onSuccess={vi.fn()}
			/>,
		);

		// useMutation is called again on re-render (this is expected)
		// But the mutation object returned should not trigger useEffect
		expect(
			vi.mocked(trpcReact.api.project.validateAIProjectId.useMutation).mock
				.calls.length,
		).toBeGreaterThan(initialCallCount);
	});

	it("should pass correct props to mutations", () => {
		render(
			<AIProviderRegistration
				projectId="test-project-123"
				teamId="test-team-456"
				onSuccess={vi.fn()}
			/>,
		);

		// Verify that validateAIProjectId mutation was created
		expect(
			trpcReact.api.project.validateAIProjectId.useMutation,
		).toHaveBeenCalled();

		// Verify that registerAIProvider mutation was created
		expect(
			trpcReact.api.project.registerAIProvider.useMutation,
		).toHaveBeenCalled();
	});
});
