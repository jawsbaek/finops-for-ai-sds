"use client";

import { Alert } from "@/components/ui/alert";
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
import { cn } from "@/lib/utils";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { useState } from "react";

export interface ImpactDetails {
	[key: string]: string | number;
}

export interface ConfirmationModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	severity: "info" | "warning" | "critical";
	message: string;
	impactDetails?: ImpactDetails;
	confirmationType?: "click" | "type-to-confirm";
	confirmText?: string;
	onConfirm: () => void;
	onCancel?: () => void;
}

const severityConfig = {
	info: {
		icon: Info,
		iconClass: "text-info",
		bgClass: "bg-info/10",
		borderClass: "border-info/30",
	},
	warning: {
		icon: AlertTriangle,
		iconClass: "text-warning",
		bgClass: "bg-warning/10",
		borderClass: "border-warning/30",
	},
	critical: {
		icon: AlertCircle,
		iconClass: "text-error",
		bgClass: "bg-error/10",
		borderClass: "border-error/30",
	},
};

export function ConfirmationModal({
	open,
	onOpenChange,
	title,
	severity,
	message,
	impactDetails,
	confirmationType = "click",
	confirmText = "확인",
	onConfirm,
	onCancel,
}: ConfirmationModalProps) {
	const [inputValue, setInputValue] = useState("");
	const config = severityConfig[severity];
	const Icon = config.icon;

	const isTypeToConfirm = confirmationType === "type-to-confirm";
	const canConfirm = !isTypeToConfirm || inputValue === confirmText;

	const handleConfirm = () => {
		if (canConfirm) {
			onConfirm();
			setInputValue("");
			onOpenChange(false);
		}
	};

	const handleCancel = () => {
		setInputValue("");
		onCancel?.();
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="sm:max-w-[500px]"
				onInteractOutside={
					severity === "critical" ? (e) => e.preventDefault() : undefined
				}
			>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Icon className={cn("h-5 w-5", config.iconClass)} />
						{title}
					</DialogTitle>
					<DialogDescription>{message}</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					{/* Impact Details */}
					{impactDetails && (
						<Alert className={cn(config.bgClass, config.borderClass)}>
							<div className="space-y-2">
								<p className="font-medium text-sm">영향 범위</p>
								{Object.entries(impactDetails).map(([impactKey, value]) => (
									<div
										key={impactKey}
										className="flex justify-between text-muted-foreground text-sm"
									>
										<span className="capitalize">
											{impactKey.replace(/([A-Z])/g, " $1").trim()}:
										</span>
										<span className="font-medium text-foreground">{value}</span>
									</div>
								))}
							</div>
						</Alert>
					)}

					{/* Type-to-Confirm Input */}
					{isTypeToConfirm && (
						<div className="space-y-2">
							<Label htmlFor="confirm-input">
								계속하려면 <strong>{confirmText}</strong>을(를) 입력하세요
							</Label>
							<Input
								id="confirm-input"
								value={inputValue}
								onChange={(e) => setInputValue(e.target.value)}
								placeholder={confirmText}
								className="font-mono"
								autoFocus
							/>
						</div>
					)}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={handleCancel}>
						취소
					</Button>
					<Button
						variant={severity === "critical" ? "destructive" : "default"}
						onClick={handleConfirm}
						disabled={!canConfirm}
					>
						{confirmText}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
