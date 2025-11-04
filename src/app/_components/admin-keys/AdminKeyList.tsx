"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Key } from "lucide-react";
import { AdminKeyCard, type AdminKeyData } from "./AdminKeyCard";

interface AdminKeyListProps {
	keys: AdminKeyData[];
	onToggle: (provider: string, orgId: string) => void;
	onDelete: (provider: string, orgId: string) => void;
	isLoading?: boolean;
}

/**
 * Admin Key List Component
 *
 * Displays a list of admin keys with empty state
 */
export function AdminKeyList({
	keys,
	onToggle,
	onDelete,
	isLoading = false,
}: AdminKeyListProps) {
	if (keys.length === 0) {
		return (
			<Alert data-testid="admin-key-empty-state">
				<Key className="h-4 w-4" />
				<AlertDescription>
					No admin keys registered yet. Register one above to get started with
					multi-organization support.
				</AlertDescription>
			</Alert>
		);
	}

	return (
		<div className="space-y-3" data-testid="admin-key-list">
			{keys.map((key) => (
				<AdminKeyCard
					key={`${key.provider}-${key.organizationId}`}
					adminKey={key}
					onToggle={() => onToggle(key.provider, key.organizationId)}
					onDelete={() => onDelete(key.provider, key.organizationId)}
					isTogglingOrDeleting={isLoading}
				/>
			))}
		</div>
	);
}
