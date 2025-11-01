"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";

export interface ChecklistItem {
	id: string | number;
	label: string;
	status: "completed" | "in-progress" | "pending" | "failed";
	timestamp?: Date;
	description?: string;
}

export interface ActionChecklistProps {
	title: string;
	items: ChecklistItem[];
	onItemClick?: (item: ChecklistItem) => void;
	className?: string;
}

const statusConfig = {
	completed: {
		icon: CheckCircle2,
		iconClass: "text-success",
		bgClass: "bg-success/10",
		borderClass: "border-success/20",
		label: "완료",
	},
	"in-progress": {
		icon: Loader2,
		iconClass: "text-warning animate-spin",
		bgClass: "bg-warning/10",
		borderClass: "border-warning/20",
		label: "진행 중",
	},
	pending: {
		icon: Circle,
		iconClass: "text-muted-foreground",
		bgClass: "bg-muted/50",
		borderClass: "border-muted",
		label: "대기",
	},
	failed: {
		icon: XCircle,
		iconClass: "text-error",
		bgClass: "bg-error/10",
		borderClass: "border-error/20",
		label: "실패",
	},
};

export function ActionChecklist({
	title,
	items,
	onItemClick,
	className,
}: ActionChecklistProps) {
	return (
		<Card className={cn("p-6", className)}>
			<h3 className="mb-4 font-semibold text-lg">{title}</h3>
			<div className="space-y-3">
				{items.map((item) => {
					const config = statusConfig[item.status];
					const Icon = config.icon;
					const clickable = !!onItemClick && item.status !== "completed";

					return (
						<div
							key={item.id}
							onClick={clickable ? () => onItemClick(item) : undefined}
							onKeyDown={
								clickable
									? (e) => {
											if (e.key === "Enter" || e.key === " ") {
												e.preventDefault();
												onItemClick(item);
											}
										}
									: undefined
							}
							role={clickable ? "button" : undefined}
							tabIndex={clickable ? 0 : undefined}
							className={cn(
								"flex items-start gap-3 rounded-lg border p-3 transition-all",
								config.bgClass,
								config.borderClass,
								clickable &&
									"cursor-pointer hover:border-primary/30 hover:bg-primary/5",
							)}
						>
							{/* Icon */}
							<Icon
								className={cn("mt-0.5 h-5 w-5 flex-shrink-0", config.iconClass)}
							/>

							{/* Content */}
							<div className="min-w-0 flex-1">
								<div className="flex items-start justify-between gap-2">
									<div className="flex-1">
										<p className="font-medium text-sm leading-none">
											{item.label}
										</p>
										{item.description && (
											<p className="mt-1 text-muted-foreground text-sm">
												{item.description}
											</p>
										)}
									</div>
									<Badge variant="outline" className="flex-shrink-0">
										{config.label}
									</Badge>
								</div>

								{/* Timestamp */}
								{item.timestamp && (
									<p className="mt-2 text-muted-foreground text-xs">
										{format(item.timestamp, "PPp", { locale: ko })}
									</p>
								)}
							</div>
						</div>
					);
				})}
			</div>
		</Card>
	);
}
