"use client";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Power, PowerOff, Trash2 } from "lucide-react";
import { useState } from "react";
import { ProviderBadge } from "../ai-provider/ProviderBadge";

/**
 * Admin Key data structure
 */
export interface AdminKeyData {
	provider: string;
	organizationId: string;
	displayName?: string;
	last4: string;
	isActive: boolean;
}

interface AdminKeyCardProps {
	adminKey: AdminKeyData;
	onToggle: () => void;
	onDelete: () => void;
	isTogglingOrDeleting?: boolean;
}

/**
 * Admin Key Card Component
 *
 * Displays an individual admin key with actions
 */
export function AdminKeyCard({
	adminKey,
	onToggle,
	onDelete,
	isTogglingOrDeleting = false,
}: AdminKeyCardProps) {
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);

	const handleDelete = () => {
		setShowDeleteDialog(false);
		onDelete();
	};

	return (
		<>
			<Card
				data-testid={`admin-key-card-${adminKey.provider}-${adminKey.organizationId}`}
				data-provider={adminKey.provider}
				data-organization-id={adminKey.organizationId}
				data-last4={adminKey.last4}
				data-is-active={adminKey.isActive}
			>
				<CardContent className="flex items-center justify-between p-4">
					<div className="flex-1 space-y-2">
						<div className="flex items-center gap-2">
							<ProviderBadge provider={adminKey.provider} showLabel />
							<Badge variant={adminKey.isActive ? "default" : "secondary"}>
								{adminKey.isActive ? "Active" : "Inactive"}
							</Badge>
						</div>

						{adminKey.displayName && (
							<p className="font-medium text-sm" data-testid="display-name">
								{adminKey.displayName}
							</p>
						)}

						<div className="space-y-1 text-muted-foreground text-xs">
							<p>Organization: {adminKey.organizationId}</p>
							<p>Key: ••••{adminKey.last4}</p>
						</div>
					</div>

					<div className="flex gap-2">
						<Button
							size="sm"
							variant="ghost"
							onClick={onToggle}
							disabled={isTogglingOrDeleting}
							data-testid="toggle-button"
							title={adminKey.isActive ? "Deactivate" : "Activate"}
						>
							{adminKey.isActive ? (
								<PowerOff className="h-4 w-4" />
							) : (
								<Power className="h-4 w-4" />
							)}
						</Button>

						<Button
							size="sm"
							variant="ghost"
							onClick={() => setShowDeleteDialog(true)}
							disabled={isTogglingOrDeleting}
							data-testid="delete-button"
							className="text-destructive hover:text-destructive"
							title="Delete"
						>
							<Trash2 className="h-4 w-4" />
						</Button>
					</div>
				</CardContent>
			</Card>

			<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Admin API Key?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete the admin API key for{" "}
							<span className="font-medium">
								{adminKey.displayName ?? adminKey.organizationId}
							</span>
							.
							<br />
							<br />
							Projects using this organization will no longer be able to collect
							costs.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							data-testid="confirm-delete"
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
