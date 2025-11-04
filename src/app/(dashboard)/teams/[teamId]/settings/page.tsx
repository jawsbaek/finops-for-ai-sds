"use client";

import { useParams } from "next/navigation";
import { AdminKeyManager } from "~/app/_components/admin-keys/AdminKeyManager";

export default function TeamSettingsPage() {
	const params = useParams();
	const teamId = params.teamId as string;

	return (
		<div className="space-y-6 p-6" data-testid="team-settings-page">
			<div>
				<h1 className="font-bold text-2xl">Team Settings</h1>
				<p className="text-muted-foreground">
					Manage team-level configuration for AI provider admin keys
				</p>
			</div>

			<AdminKeyManager teamId={teamId} />

			{/* Information Card */}
			<div className="rounded-lg border border-border bg-card p-6">
				<h3 className="mb-2 font-medium text-sm">What are Admin API Keys?</h3>
				<p className="text-muted-foreground text-sm">
					Admin API Keys allow this team to access provider-level cost data
					across all your AI projects. You can register keys for multiple
					providers (OpenAI, Anthropic, AWS, Azure) and multiple organizations
					per provider. These keys require admin permissions and are different
					from project-level API keys.
				</p>
			</div>
		</div>
	);
}
