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
import { useState } from "react";

/**
 * Form data for admin key registration
 */
export interface AdminKeyFormData {
	provider: "openai" | "anthropic" | "aws" | "azure";
	apiKey: string;
	organizationId?: string;
	displayName?: string;
}

interface AdminKeyRegistrationFormProps {
	onSubmit: (data: AdminKeyFormData) => void;
	isLoading?: boolean;
}

/**
 * Admin Key Registration Form Component
 *
 * Form for registering a new admin API key with provider selection
 */
export function AdminKeyRegistrationForm({
	onSubmit,
	isLoading = false,
}: AdminKeyRegistrationFormProps) {
	const [formData, setFormData] = useState<AdminKeyFormData>({
		provider: "openai",
		apiKey: "",
		organizationId: "",
		displayName: "",
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		onSubmit({
			provider: formData.provider,
			apiKey: formData.apiKey,
			organizationId: formData.organizationId || undefined,
			displayName: formData.displayName || undefined,
		});
	};

	const isOpenAI = formData.provider === "openai";

	return (
		<form
			onSubmit={handleSubmit}
			className="space-y-4"
			data-testid="admin-key-form"
		>
			<div className="space-y-2">
				<Label htmlFor="provider">Provider</Label>
				<Select
					value={formData.provider}
					onValueChange={(value) =>
						setFormData({
							...formData,
							provider: value as AdminKeyFormData["provider"],
						})
					}
					name="provider"
				>
					<SelectTrigger id="provider">
						<SelectValue placeholder="Select provider" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="openai">OpenAI</SelectItem>
						<SelectItem value="anthropic">Anthropic</SelectItem>
						<SelectItem value="aws">AWS</SelectItem>
						<SelectItem value="azure">Azure</SelectItem>
					</SelectContent>
				</Select>
			</div>

			<div className="space-y-2">
				<Label htmlFor="apiKey">Admin API Key</Label>
				<Input
					id="apiKey"
					name="apiKey"
					type="password"
					value={formData.apiKey}
					onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
					placeholder={
						isOpenAI ? "sk-admin-proj-..." : "Enter your admin API key"
					}
					required
					disabled={isLoading}
				/>
			</div>

			<div className="space-y-2">
				<Label htmlFor="organizationId">
					Organization ID {isOpenAI && "(Optional)"}
				</Label>
				<Input
					id="organizationId"
					name="organizationId"
					type="text"
					value={formData.organizationId}
					onChange={(e) =>
						setFormData({ ...formData, organizationId: e.target.value })
					}
					placeholder={
						isOpenAI ? "Auto-detected if not provided" : "org-xxx or ws-xxx"
					}
					disabled={isLoading}
				/>
				{isOpenAI && (
					<p className="text-muted-foreground text-xs">
						For OpenAI, the organization ID will be automatically detected from
						your API key if not provided.
					</p>
				)}
			</div>

			<div className="space-y-2">
				<Label htmlFor="displayName">Display Name (Optional)</Label>
				<Input
					id="displayName"
					name="displayName"
					type="text"
					value={formData.displayName}
					onChange={(e) =>
						setFormData({ ...formData, displayName: e.target.value })
					}
					placeholder="e.g., Production Org, Development Org"
					maxLength={100}
					disabled={isLoading}
				/>
				<p className="text-muted-foreground text-xs">
					A friendly name to help identify this organization.
				</p>
			</div>

			<Alert>
				<AlertCircle className="h-4 w-4" />
				<AlertDescription>
					<div className="space-y-1 text-xs">
						<p className="font-medium">Security Notice</p>
						<ul className="ml-4 list-disc space-y-1">
							<li>Your API key is encrypted with AWS KMS before storage</li>
							<li>Only the last 4 characters are visible in the UI</li>
							<li>All key operations are logged for audit purposes</li>
						</ul>
					</div>
				</AlertDescription>
			</Alert>

			<Button type="submit" disabled={isLoading || !formData.apiKey.trim()}>
				{isLoading ? (
					<>
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						Registering...
					</>
				) : (
					"Register Admin Key"
				)}
			</Button>
		</form>
	);
}
