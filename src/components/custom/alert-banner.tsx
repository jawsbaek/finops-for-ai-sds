"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
	AlertCircle,
	AlertTriangle,
	Info,
	type LucideIcon,
	X,
} from "lucide-react";
import { type ReactNode, useState } from "react";

export interface AlertAction {
	label: string;
	variant?: "default" | "destructive" | "outline" | "ghost";
	onClick: () => void;
}

export interface AlertBannerProps {
	type: "info" | "warning" | "critical";
	title: string;
	message: string;
	actions?: AlertAction[];
	dismissible?: boolean;
	onDismiss?: () => void;
	className?: string;
}

const typeConfig: Record<
	"info" | "warning" | "critical",
	{
		icon: LucideIcon;
		bgClass: string;
		borderClass: string;
		iconClass: string;
	}
> = {
	info: {
		icon: Info,
		bgClass: "bg-info/10",
		borderClass: "border-info/30",
		iconClass: "text-info",
	},
	warning: {
		icon: AlertTriangle,
		bgClass: "bg-warning/10",
		borderClass: "border-warning/30",
		iconClass: "text-warning",
	},
	critical: {
		icon: AlertCircle,
		bgClass: "bg-error/10",
		borderClass: "border-error/30",
		iconClass: "text-error",
	},
};

export function AlertBanner({
	type,
	title,
	message,
	actions = [],
	dismissible = true,
	onDismiss,
	className,
}: AlertBannerProps) {
	const [visible, setVisible] = useState(true);

	const config = typeConfig[type];
	const Icon = config.icon;

	const handleDismiss = () => {
		setVisible(false);
		onDismiss?.();
	};

	if (!visible) return null;

	return (
		<div
			className={cn(
				"slide-in-from-top sticky top-0 z-50 w-full animate-in duration-300",
				className,
			)}
		>
			<Alert
				className={cn(
					"rounded-none border-x-0 border-t-0 border-b-2",
					config.bgClass,
					config.borderClass,
				)}
			>
				<div className="flex items-start justify-between gap-4">
					{/* Icon + Content */}
					<div className="flex flex-1 items-start gap-3">
						<Icon className={cn("mt-0.5 h-5 w-5", config.iconClass)} />
						<div className="flex-1 space-y-1">
							<h4 className="font-semibold text-sm leading-none tracking-tight">
								{title}
							</h4>
							<p className="text-muted-foreground text-sm">{message}</p>

							{/* Actions */}
							{actions.length > 0 && (
								<div className="mt-3 flex items-center gap-2">
									{actions.map((action) => (
										<Button
											key={action.label}
											variant={action.variant || "default"}
											size="sm"
											onClick={action.onClick}
										>
											{action.label}
										</Button>
									))}
								</div>
							)}
						</div>
					</div>

					{/* Dismiss Button */}
					{dismissible && (
						<Button
							variant="ghost"
							size="sm"
							onClick={handleDismiss}
							className="h-6 w-6 p-0"
						>
							<X className="h-4 w-4" />
							<span className="sr-only">닫기</span>
						</Button>
					)}
				</div>
			</Alert>
		</div>
	);
}
