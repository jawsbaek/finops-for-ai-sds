"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Key } from "lucide-react";
import { useState } from "react";

interface AddApiKeyDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: (provider: "openai", apiKey: string) => void;
	isLoading?: boolean;
	serverError?: string;
}

/**
 * Dialog for adding an API key to a project
 *
 * Features:
 * - Provider selection (currently OpenAI only)
 * - Masked API key input
 * - Client-side validation
 * - Security warnings
 */
export function AddApiKeyDialog({
	open,
	onOpenChange,
	onConfirm,
	isLoading = false,
	serverError,
}: AddApiKeyDialogProps) {
	const [provider, setProvider] = useState<"openai">("openai");
	const [apiKey, setApiKey] = useState("");
	const [clientError, setClientError] = useState("");

	// Combine client and server errors, prioritizing server errors
	const error = serverError || clientError;

	const handleConfirm = () => {
		// Validate API key format
		if (!apiKey.trim()) {
			setClientError("API 키를 입력해주세요");
			return;
		}

		if (provider === "openai" && !apiKey.startsWith("sk-")) {
			setClientError(
				"올바른 OpenAI API 키 형식이 아닙니다 (sk-로 시작해야 합니다)",
			);
			return;
		}

		setClientError("");
		onConfirm(provider, apiKey);
		// Form will be reset when dialog closes via handleOpenChange
	};

	const handleCancel = () => {
		onOpenChange(false);
	};

	// Reset form when dialog closes
	const handleOpenChange = (newOpen: boolean) => {
		if (!newOpen) {
			setProvider("openai");
			setApiKey("");
			setClientError("");
		}
		onOpenChange(newOpen);
	};

	const isConfirmEnabled = apiKey.trim().length > 0;

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
							<Key className="h-5 w-5 text-primary" />
						</div>
						<div className="flex-1">
							<DialogTitle>API 키 추가</DialogTitle>
							<DialogDescription>
								프로젝트에 새로운 API 키를 추가합니다
							</DialogDescription>
						</div>
					</div>
				</DialogHeader>

				<div className="space-y-4 py-4">
					<div className="space-y-2">
						<Label htmlFor="provider-select">
							Provider <span className="text-destructive">*</span>
						</Label>
						<Select
							value={provider}
							onValueChange={(value) => setProvider(value as "openai")}
							disabled={isLoading}
						>
							<SelectTrigger id="provider-select">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="openai">OpenAI</SelectItem>
							</SelectContent>
						</Select>
						<p className="text-muted-foreground text-xs">
							현재 OpenAI만 지원됩니다
						</p>
					</div>

					<div className="space-y-2">
						<Label htmlFor="api-key-input">
							API Key <span className="text-destructive">*</span>
						</Label>
						<Input
							id="api-key-input"
							type="password"
							placeholder="sk-..."
							value={apiKey}
							onChange={(e) => {
								setApiKey(e.target.value);
								setClientError("");
							}}
							disabled={isLoading}
							className="font-mono"
						/>
						{error && (
							<p className="flex items-center gap-1 text-destructive text-sm">
								<AlertCircle className="h-3 w-3" />
								{error}
							</p>
						)}
						<p className="text-muted-foreground text-xs">
							OpenAI API 키는 sk-로 시작합니다
						</p>
					</div>

					<div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
						<div className="flex items-start gap-2">
							<AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
							<div className="space-y-1 text-sm leading-relaxed">
								<p className="font-semibold text-foreground">보안 주의사항</p>
								<ul className="ml-4 list-disc space-y-1 text-muted-foreground">
									<li>API 키는 암호화되어 안전하게 저장됩니다</li>
									<li>저장 후 전체 키는 다시 확인할 수 없습니다</li>
									<li>마지막 4자리만 표시됩니다</li>
								</ul>
							</div>
						</div>
					</div>
				</div>

				<DialogFooter className="gap-2 sm:gap-0">
					<Button
						type="button"
						variant="outline"
						onClick={handleCancel}
						disabled={isLoading}
					>
						취소
					</Button>
					<Button
						type="button"
						onClick={handleConfirm}
						disabled={!isConfirmEnabled || isLoading}
					>
						{isLoading ? "추가 중..." : "API 키 추가"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
