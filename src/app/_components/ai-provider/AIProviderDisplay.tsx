"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import { ProviderBadge } from "./ProviderBadge";

interface AIProviderDisplayProps {
	projectId: string;
	provider: string;
	organizationId: string;
	aiProjectId: string;
	displayName?: string;
	hasAdminKey?: boolean;
	onUnlink?: () => void;
}

/**
 * AI Provider Display Component
 *
 * Shows current provider configuration with update/unlink actions
 */
export function AIProviderDisplay({
	projectId,
	provider,
	organizationId,
	aiProjectId,
	displayName,
	hasAdminKey = true,
	onUnlink,
}: AIProviderDisplayProps) {
	const [showUnlinkDialog, setShowUnlinkDialog] = useState(false);

	// Unlink mutation
	const unlinkMutation = api.project.unlinkAIProvider.useMutation({
		onSuccess: () => {
			toast.success("Provider unlinked successfully");
			onUnlink?.();
		},
		onError: (error) => {
			toast.error("Failed to unlink provider", {
				description: error.message,
			});
		},
	});

	const handleUnlink = () => {
		setShowUnlinkDialog(false);
		unlinkMutation.mutate({ projectId });
	};

	// Mask project ID (show first 6 and last 4 characters)
	const maskProjectId = (id: string) => {
		if (id.length <= 10) return id;
		const prefix = id.slice(0, 6);
		const suffix = id.slice(-4);
		return `${prefix}••••••${suffix}`;
	};

	return (
		<>
			<Card
				data-testid="ai-provider-display"
				data-provider={provider}
				data-organization-id={organizationId}
				data-ai-project-id={aiProjectId}
			>
				<CardContent className="space-y-4 p-4">
					{!hasAdminKey && (
						<Alert variant="destructive" data-testid="provider-warning">
							<AlertTriangle className="h-4 w-4" />
							<AlertDescription>
								Admin key no longer available. Costs cannot be collected for
								this project.
							</AlertDescription>
						</Alert>
					)}

					<div className="space-y-2">
						<ProviderBadge provider={provider} showLabel size="lg" />

						<div className="space-y-1 text-sm">
							<p data-testid="organization-name">
								<span className="text-muted-foreground">Organization: </span>
								<span className="font-medium">
									{displayName ?? organizationId}
								</span>
							</p>

							<p>
								<span className="text-muted-foreground">Project: </span>
								<span className="font-mono text-xs">
									{maskProjectId(aiProjectId)}
								</span>
							</p>
						</div>
					</div>

					<div className="flex gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setShowUnlinkDialog(true)}
							disabled={unlinkMutation.isPending}
							data-testid="unlink-provider-button"
						>
							Unlink Provider
						</Button>
					</div>
				</CardContent>
			</Card>

			<AlertDialog open={showUnlinkDialog} onOpenChange={setShowUnlinkDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Unlink AI Provider?</AlertDialogTitle>
						<AlertDialogDescription>
							This will remove the provider association from this project.
							<br />
							<br />
							Cost collection will stop for this project until you register a
							new provider.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleUnlink}
							data-testid="confirm-unlink"
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							Unlink
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
