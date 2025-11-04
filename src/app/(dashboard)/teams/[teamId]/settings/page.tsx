"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, BookOpen, Key, Shield } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AdminKeyManager } from "~/app/_components/admin-keys/AdminKeyManager";
import { api } from "~/trpc/react";

export default function TeamSettingsPage() {
	const params = useParams();
	const teamId = params.teamId as string;

	// Fetch admin keys to show status
	const { data: adminKeys, isLoading: isLoadingAdminKeys } =
		api.team.getAdminApiKeys.useQuery({ teamId });

	const hasActiveKeys = adminKeys?.some((k) => k.isActive) ?? false;

	return (
		<div className="space-y-8 p-6" data-testid="team-settings-page">
			{/* Header */}
			<div>
				<h1 className="font-bold text-3xl tracking-tight">Team Settings</h1>
				<p className="mt-2 text-muted-foreground">
					Manage team-level Admin API Keys for AI provider cost tracking
				</p>
			</div>

			{/* Quick Status Banner */}
			{!isLoadingAdminKeys && !hasActiveKeys && (
				<Alert variant="default" className="border-primary bg-primary/10">
					<AlertCircle className="h-4 w-4 text-primary" />
					<AlertDescription>
						<div className="flex items-center justify-between">
							<div>
								<p className="font-medium text-foreground text-sm">
									Setup Required
								</p>
								<p className="text-muted-foreground text-xs">
									Register an Admin API Key to start tracking costs across all
									your projects.
								</p>
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									document
										.getElementById("admin-key-registration")
										?.scrollIntoView({ behavior: "smooth" });
								}}
								className="border-primary hover:bg-primary/20"
							>
								Get Started
							</Button>
						</div>
					</AlertDescription>
				</Alert>
			)}

			{/* Admin Key Manager */}
			<div id="admin-key-registration">
				<AdminKeyManager teamId={teamId} />
			</div>

			<Separator />

			{/* Information Section */}
			<div className="grid gap-6 md:grid-cols-2">
				{/* What are Admin API Keys? */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-base">
							<Key className="h-5 w-5 text-primary" />
							What are Admin API Keys?
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3 text-muted-foreground text-sm">
						<p>
							Admin API Keys enable <strong>organization-level</strong> cost
							tracking across all your AI projects.
						</p>
						<ul className="ml-4 list-disc space-y-2">
							<li>
								<strong>One key per organization</strong> - Track costs for all
								projects under that organization
							</li>
							<li>
								<strong>Multi-provider support</strong> - OpenAI, Anthropic,
								AWS, Azure
							</li>
							<li>
								<strong>Multiple organizations</strong> - Register keys for
								different organizations within each provider
							</li>
							<li>
								<strong>Automatic cost collection</strong> - Daily batch jobs
								collect cost data using these keys
							</li>
						</ul>
					</CardContent>
				</Card>

				{/* Security & Compliance */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-base">
							<Shield className="h-5 w-5 text-primary" />
							Security & Compliance
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3 text-muted-foreground text-sm">
						<p>Your API keys are protected with enterprise-grade security:</p>
						<ul className="ml-4 list-disc space-y-2">
							<li>
								<strong>KMS Envelope Encryption</strong> - Keys encrypted with
								AWS KMS before storage
							</li>
							<li>
								<strong>Zero plaintext storage</strong> - Only encrypted data in
								database
							</li>
							<li>
								<strong>Minimal exposure</strong> - UI shows only last 4
								characters
							</li>
							<li>
								<strong>Audit logging</strong> - All key operations tracked for
								compliance
							</li>
							<li>
								<strong>Role-based access</strong> - Only team owners/admins can
								manage keys
							</li>
						</ul>
					</CardContent>
				</Card>
			</div>

			{/* Setup Guide */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-base">
						<BookOpen className="h-5 w-5 text-primary" />
						Setup Guide: OpenAI Admin API Key
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4 text-sm">
					<div className="space-y-2">
						<h4 className="font-semibold">Step 1: Generate Admin API Key</h4>
						<ol className="ml-6 list-decimal space-y-1 text-muted-foreground">
							<li>
								Go to{" "}
								<Link
									href="https://platform.openai.com/settings/organization/general"
									target="_blank"
									rel="noopener noreferrer"
									className="text-primary hover:underline"
								>
									OpenAI Organization Settings
								</Link>
							</li>
							<li>Click on "API Keys" in the left sidebar</li>
							<li>Click "Create new secret key"</li>
							<li>
								Select <strong>Admin</strong> permissions (not "Service
								Account")
							</li>
							<li>Copy the key (starts with sk-admin-proj-...)</li>
						</ol>
					</div>

					<Alert>
						<AlertCircle className="h-4 w-4" />
						<AlertDescription className="text-xs">
							<strong>Important:</strong> Make sure you have{" "}
							<strong>Organization Admin</strong> role in OpenAI. Regular member
							keys won't work for cost tracking.
						</AlertDescription>
					</Alert>

					<div className="space-y-2">
						<h4 className="font-semibold">Step 2: Register Key in This Team</h4>
						<p className="text-muted-foreground">
							Paste your Admin API Key in the registration form above. The
							organization ID will be automatically detected from your key.
						</p>
					</div>

					<div className="space-y-2">
						<h4 className="font-semibold">
							Step 3: Register Project IDs (Next Step)
						</h4>
						<p className="text-muted-foreground">
							After registering your Admin Key, go to each project's settings to
							register the OpenAI Project ID (proj_...). This links your
							internal projects to OpenAI projects for cost attribution.
						</p>
					</div>
				</CardContent>
			</Card>

			{/* Migration Notice */}
			<Alert>
				<AlertCircle className="h-4 w-4" />
				<AlertDescription className="text-xs">
					<strong>Migration from Usage API:</strong> This system uses OpenAI's
					Costs API for organization-level cost tracking. If you previously used
					project-level API keys, those are now deprecated. Admin API Keys
					provide better visibility and reduce API call overhead.
				</AlertDescription>
			</Alert>
		</div>
	);
}
