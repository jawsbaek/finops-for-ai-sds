"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import { ValidationIndicator } from "./ValidationIndicator";

interface AIProviderRegistrationProps {
	projectId: string;
	teamId: string;
	onSuccess?: () => void;
}

/**
 * AI Provider Registration Component
 *
 * Form for registering AI provider with real-time validation
 */
export function AIProviderRegistration({
	projectId,
	teamId,
	onSuccess,
}: AIProviderRegistrationProps) {
	const [selectedProvider, setSelectedProvider] = useState<string>("");
	const [selectedOrg, setSelectedOrg] = useState<string>("");
	const [projectIdInput, setProjectIdInput] = useState<string>("");
	const [validationStatus, setValidationStatus] = useState<
		"idle" | "validating" | "valid" | "invalid"
	>("idle");
	const [validationError, setValidationError] = useState<string>("");

	// Fetch admin keys for the team
	const { data: adminKeys } = api.team.getAdminApiKeys.useQuery(
		{ teamId },
		{
			refetchOnWindowFocus: false,
		},
	);

	// Register mutation
	const registerMutation = api.project.registerAIProvider.useMutation({
		onSuccess: () => {
			toast.success("Provider registered successfully");
			setProjectIdInput("");
			setSelectedProvider("");
			setSelectedOrg("");
			setValidationStatus("idle");
			onSuccess?.();
		},
		onError: (error) => {
			toast.error("Failed to register provider", {
				description: error.message,
			});
		},
	});

	// Get unique providers from admin keys
	const providers = [
		...new Set(
			adminKeys?.filter((k) => k.isActive).map((k) => k.provider) ?? [],
		),
	];

	// Get organizations for selected provider
	const organizations =
		adminKeys?.filter((k) => k.provider === selectedProvider && k.isActive) ??
		[];

	// Real-time validation via API
	const validateMutation = api.project.validateAIProjectId.useMutation();

	// biome-ignore lint/correctness/useExhaustiveDependencies: validateMutation is excluded intentionally - it's recreated on every render but we only want validation to trigger when input values change
	useEffect(() => {
		let isCancelled = false;
		if (!projectIdInput.trim() || !selectedProvider || !selectedOrg) {
			setValidationStatus("idle");
			return;
		}

		// Debounce validation
		const timer = setTimeout(() => {
			setValidationStatus("validating");

			validateMutation.mutate(
				{
					projectId,
					provider: selectedProvider as
						| "openai"
						| "anthropic"
						| "aws"
						| "azure",
					organizationId: selectedOrg,
					aiProjectId: projectIdInput,
				},
				{
					onSuccess: (result) => {
						if (isCancelled) return; // Don't update if effect was cancelled
						if (result.valid) {
							setValidationStatus("valid");
							setValidationError("");
						} else {
							setValidationStatus("invalid");
							setValidationError(result.error ?? "Invalid project ID");
						}
					},
					onError: (error) => {
						if (isCancelled) return; // Don't update if effect was cancelled
						setValidationStatus("invalid");
						setValidationError(error.message);
					},
				},
			);
		}, 500);

		return () => {
			clearTimeout(timer);
			isCancelled = true; // Mark as cancelled to prevent state updates
		};
	}, [projectIdInput, selectedProvider, selectedOrg, projectId]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		if (validationStatus !== "valid") {
			toast.error("Please wait for validation to complete");
			return;
		}

		registerMutation.mutate({
			projectId,
			provider: selectedProvider as "openai" | "anthropic" | "aws" | "azure",
			organizationId: selectedOrg,
			aiProjectId: projectIdInput,
		});
	};

	// Show info if no admin keys available
	if (!adminKeys || adminKeys.length === 0 || providers.length === 0) {
		return (
			<Alert data-testid="provider-info">
				<AlertCircle className="h-4 w-4" />
				<AlertDescription>
					No admin keys registered yet. Please register an admin key in Team
					Settings first.
				</AlertDescription>
			</Alert>
		);
	}

	return (
		<form
			onSubmit={handleSubmit}
			className="space-y-4"
			data-testid="ai-provider-form"
		>
			<div className="space-y-2">
				<Label htmlFor="provider">AI Provider</Label>
				<Select
					value={selectedProvider}
					onValueChange={(value) => {
						setSelectedProvider(value);
						setSelectedOrg("");
						setProjectIdInput("");
						setValidationStatus("idle");
					}}
					name="provider"
				>
					<SelectTrigger id="provider">
						<SelectValue placeholder="Select provider" />
					</SelectTrigger>
					<SelectContent>
						{providers.map((p) => (
							<SelectItem key={p} value={p}>
								{p.charAt(0).toUpperCase() + p.slice(1)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{selectedProvider && (
				<div className="space-y-2">
					<Label htmlFor="organizationId">Organization</Label>
					<Select
						value={selectedOrg}
						onValueChange={(value) => {
							setSelectedOrg(value);
							setProjectIdInput("");
							setValidationStatus("idle");
						}}
						name="organizationId"
					>
						<SelectTrigger id="organizationId">
							<SelectValue placeholder="Select organization" />
						</SelectTrigger>
						<SelectContent>
							{organizations.map((org) => (
								<SelectItem
									key={org.organizationId}
									value={org.organizationId ?? ""}
								>
									{org.displayName ?? org.organizationId}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			)}

			{selectedOrg && (
				<div className="space-y-2">
					<Label htmlFor="aiProjectId">AI Project ID</Label>
					<Input
						id="aiProjectId"
						name="aiProjectId"
						type="text"
						value={projectIdInput}
						onChange={(e) => setProjectIdInput(e.target.value)}
						placeholder={
							selectedProvider === "openai" ? "proj_..." : "Enter project ID"
						}
						disabled={registerMutation.isPending}
					/>
				</div>
			)}

			{projectIdInput && (
				<ValidationIndicator
					status={validationStatus}
					error={validationError}
				/>
			)}

			<Button
				type="submit"
				disabled={validationStatus !== "valid" || registerMutation.isPending}
			>
				{registerMutation.isPending ? (
					<>
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						Registering...
					</>
				) : (
					"Register Provider"
				)}
			</Button>
		</form>
	);
}
