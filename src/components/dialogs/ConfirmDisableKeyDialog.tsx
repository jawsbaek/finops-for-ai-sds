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
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";

interface ConfirmDisableKeyDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: (reason: string) => void;
	isLoading?: boolean;
	apiKeyLast4?: string;
}

/**
 * Type-to-confirm dialog for disabling API keys
 *
 * Implements strong confirmation pattern:
 * - User must type exact string "차단" to enable confirm button
 * - Requires reason input
 * - Shows destructive warning
 */
export function ConfirmDisableKeyDialog({
	open,
	onOpenChange,
	onConfirm,
	isLoading = false,
	apiKeyLast4,
}: ConfirmDisableKeyDialogProps) {
	const [confirmText, setConfirmText] = useState("");
	const [reason, setReason] = useState("");

	const handleConfirm = () => {
		if (confirmText === "차단" && reason.trim()) {
			onConfirm(reason);
			// Form will be reset when dialog closes via handleOpenChange
		}
	};

	const handleCancel = () => {
		onOpenChange(false);
		// Form will be reset via handleOpenChange
	};

	const isConfirmEnabled = confirmText === "차단" && reason.trim().length > 0;

	// Reset form when dialog closes
	const handleOpenChange = (newOpen: boolean) => {
		if (!newOpen) {
			setConfirmText("");
			setReason("");
		}
		onOpenChange(newOpen);
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
							<AlertTriangle className="h-5 w-5 text-destructive" />
						</div>
						<div className="flex-1">
							<DialogTitle>API 키 비활성화</DialogTitle>
							<DialogDescription>
								이 키를 사용하는 모든 애플리케이션이 중단됩니다
							</DialogDescription>
						</div>
					</div>
				</DialogHeader>

				<div className="space-y-4 py-4">
					{apiKeyLast4 && (
						<div className="rounded-lg border border-border bg-muted p-3">
							<p className="font-medium text-sm">API 키: ...{apiKeyLast4}</p>
						</div>
					)}

					<div className="space-y-2">
						<Label htmlFor="reason">
							비활성화 사유 <span className="text-destructive">*</span>
						</Label>
						<Textarea
							id="reason"
							placeholder="예: 비용 폭주 감지, 보안 위협 등"
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							disabled={isLoading}
							className="min-h-[80px]"
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="confirm">
							확인하려면 <span className="font-bold font-mono">차단</span>을
							입력하세요 <span className="text-destructive">*</span>
						</Label>
						<Input
							id="confirm"
							placeholder="차단"
							value={confirmText}
							onChange={(e) => setConfirmText(e.target.value)}
							disabled={isLoading}
							className="font-mono"
						/>
					</div>

					<div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
						<p className="text-sm leading-relaxed">
							<span className="font-semibold">경고:</span> 이 작업은 즉시
							실행됩니다. 비활성화된 API 키로 요청하는 모든 애플리케이션은 즉시
							차단됩니다.
						</p>
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
						variant="destructive"
						onClick={handleConfirm}
						disabled={!isConfirmEnabled || isLoading}
					>
						{isLoading ? "비활성화 중..." : "API 키 비활성화"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
