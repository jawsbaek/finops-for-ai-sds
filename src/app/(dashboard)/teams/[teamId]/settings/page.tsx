"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Check, Key, Loader2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "~/trpc/react";

export default function TeamSettingsPage() {
	const params = useParams();
	const teamId = params.teamId as string;

	const [apiKey, setApiKey] = useState("");

	// Fetch Admin API Key status
	const { data: adminKeyStatus, refetch } =
		api.team.getAdminApiKeyStatus.useQuery(
			{ teamId },
			{
				refetchOnWindowFocus: false,
			},
		);

	// Register/Update Admin API Key mutation
	const registerMutation = api.team.registerAdminApiKey.useMutation({
		onSuccess: (data) => {
			toast.success("Admin API Key registered successfully", {
				description: `Key ending in ${data.last4} is now active`,
			});
			setApiKey("");
			void refetch();
		},
		onError: (error) => {
			toast.error("Failed to register Admin API Key", {
				description: error.message,
			});
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		if (!apiKey.trim()) {
			toast.error("API Key is required");
			return;
		}

		registerMutation.mutate({ teamId, apiKey });
	};

	return (
		<div className="space-y-6 p-6">
			<div>
				<h1 className="font-bold text-2xl">Team Settings</h1>
				<p className="text-muted-foreground">
					Manage team-level configuration for OpenAI Costs API
				</p>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Key className="h-5 w-5" />
						OpenAI Admin API Key
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Status Display */}
					{adminKeyStatus ? (
						<Alert className="border-success/20 bg-success/10">
							<Check className="h-4 w-4 text-success" />
							<AlertDescription className="text-success-foreground">
								<div className="space-y-1">
									<p className="font-medium">
										Admin API Key registered (ends with •••
										{adminKeyStatus.last4})
									</p>
									<p className="text-sm">
										Status: {adminKeyStatus.isActive ? "Active" : "Inactive"}
									</p>
									<p className="text-muted-foreground text-sm">
										Last updated:{" "}
										{new Date(adminKeyStatus.updatedAt).toLocaleDateString()}
									</p>
								</div>
							</AlertDescription>
						</Alert>
					) : (
						<Alert>
							<AlertCircle className="h-4 w-4" />
							<AlertDescription>
								No Admin API Key registered. Register one to enable OpenAI Costs
								API data collection for this team.
							</AlertDescription>
						</Alert>
					)}

					{/* Registration Form */}
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="apiKey">Admin API Key</Label>
							<Input
								id="apiKey"
								type="password"
								value={apiKey}
								onChange={(e) => setApiKey(e.target.value)}
								placeholder="sk-admin-proj-..."
								disabled={registerMutation.isPending}
							/>
							<p className="text-muted-foreground text-xs">
								This key must have admin permissions for your OpenAI
								organization. Get it from{" "}
								<a
									href="https://platform.openai.com/settings/organization/api-keys"
									target="_blank"
									rel="noopener noreferrer"
									className="underline hover:text-primary"
								>
									OpenAI Settings
								</a>
							</p>
						</div>

						<div className="space-y-2 rounded-md bg-muted p-4">
							<p className="font-medium text-sm">Security Notice</p>
							<ul className="list-inside list-disc space-y-1 text-muted-foreground text-xs">
								<li>Your API key is encrypted with AWS KMS before storage</li>
								<li>Only the last 4 characters are visible in the UI</li>
								<li>Only team owners and admins can register API keys</li>
								<li>All key operations are logged for audit purposes</li>
							</ul>
						</div>

						<Button
							type="submit"
							disabled={registerMutation.isPending || !apiKey.trim()}
							className="w-full sm:w-auto"
						>
							{registerMutation.isPending ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Registering...
								</>
							) : (
								<>{adminKeyStatus ? "Update" : "Register"} Admin API Key</>
							)}
						</Button>
					</form>

					{/* Additional Information */}
					<div className="border-t pt-4">
						<h3 className="mb-2 font-medium text-sm">
							What is an Admin API Key?
						</h3>
						<p className="text-muted-foreground text-sm">
							The Admin API Key allows this team to access the OpenAI Costs API,
							which provides organization-level cost data across all your OpenAI
							projects. This is different from project-level API keys and
							requires admin permissions.
						</p>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
