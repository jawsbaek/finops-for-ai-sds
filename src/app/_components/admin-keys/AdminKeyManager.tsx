"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Key } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { api } from "~/trpc/react";
import { AdminKeyList } from "./AdminKeyList";
import {
	type AdminKeyFormData,
	AdminKeyRegistrationForm,
} from "./AdminKeyRegistrationForm";

// Provider schema for runtime validation
const ProviderSchema = z.enum(["openai", "anthropic", "aws", "azure"]);

interface AdminKeyManagerProps {
	teamId: string;
}

/**
 * Admin Key Manager Component
 *
 * Main container for admin key management (registration + list)
 */
export function AdminKeyManager({ teamId }: AdminKeyManagerProps) {
	// Fetch admin keys
	const { data: adminKeys, refetch } = api.team.getAdminApiKeys.useQuery(
		{ teamId },
		{
			refetchOnWindowFocus: false,
		},
	);

	// Register mutation
	const registerMutation = api.team.registerAdminApiKey.useMutation({
		onSuccess: (data) => {
			toast.success("Admin API Key registered successfully", {
				description: `Key ending in ${data.last4} is now active`,
			});
			void refetch();
		},
		onError: (error) => {
			toast.error("Failed to register Admin API Key", {
				description: error.message,
			});
		},
	});

	// Delete mutation
	const deleteMutation = api.team.deleteAdminApiKey.useMutation({
		onSuccess: () => {
			toast.success("Admin key deleted successfully");
			void refetch();
		},
		onError: (error) => {
			toast.error("Failed to delete admin key", {
				description: error.message,
			});
		},
	});

	// Toggle mutation
	const toggleMutation = api.team.toggleAdminApiKey.useMutation({
		onSuccess: (data) => {
			toast.success("Status updated successfully", {
				description: data.isActive ? "Key activated" : "Key deactivated",
			});
			void refetch();
		},
		onError: (error) => {
			toast.error("Failed to update status", {
				description: error.message,
			});
		},
	});

	const handleSubmit = (data: AdminKeyFormData) => {
		registerMutation.mutate({
			teamId,
			...data,
		});
	};

	const handleToggle = (provider: string, orgId: string) => {
		const key = adminKeys?.find(
			(k) => k.provider === provider && k.organizationId === orgId,
		);
		if (!key) return;

		// Validate provider with runtime check
		const validatedProvider = ProviderSchema.safeParse(provider);
		if (!validatedProvider.success) {
			toast.error("Invalid provider type");
			return;
		}

		toggleMutation.mutate({
			teamId,
			provider: validatedProvider.data,
			organizationId: orgId,
			isActive: !key.isActive,
		});
	};

	const handleDelete = (provider: string, orgId: string) => {
		// Validate provider with runtime check
		const validatedProvider = ProviderSchema.safeParse(provider);
		if (!validatedProvider.success) {
			toast.error("Invalid provider type");
			return;
		}

		deleteMutation.mutate({
			teamId,
			provider: validatedProvider.data,
			organizationId: orgId,
		});
	};

	return (
		<div className="space-y-6">
			{/* Registration Form */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Key className="h-5 w-5" />
						Register Admin API Key
					</CardTitle>
				</CardHeader>
				<CardContent>
					<AdminKeyRegistrationForm
						onSubmit={handleSubmit}
						isLoading={registerMutation.isPending}
					/>
				</CardContent>
			</Card>

			<Separator />

			{/* Admin Keys List */}
			<div className="space-y-4">
				<h3 className="font-semibold text-lg">Registered Admin Keys</h3>
				<AdminKeyList
					keys={
						adminKeys
							?.filter(
								(k): k is typeof k & { organizationId: string } =>
									k.organizationId != null,
							)
							.map((k) => ({
								provider: k.provider,
								organizationId: k.organizationId,
								displayName: k.displayName ?? undefined,
								last4: k.last4,
								isActive: k.isActive,
							})) ?? []
					}
					onToggle={handleToggle}
					onDelete={handleDelete}
					isLoading={deleteMutation.isPending || toggleMutation.isPending}
				/>
			</div>
		</div>
	);
}
