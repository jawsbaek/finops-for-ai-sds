"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { type LucideIcon, TrendingDown, TrendingUp } from "lucide-react";

export interface ProjectAction {
	icon: LucideIcon;
	label: string;
	onClick: () => void;
}

export interface ProjectTrend {
	current: string;
	previous: string;
	change: string;
}

export interface ProjectCardProps {
	name: string;
	team: string;
	cost: string;
	status: "normal" | "warning" | "critical";
	trend?: ProjectTrend;
	actions?: ProjectAction[];
	onClick?: () => void;
	className?: string;
}

const statusConfig = {
	normal: {
		borderClass: "border-border hover:border-border/80",
		badgeVariant: "default" as const,
		animation: "",
	},
	warning: {
		borderClass: "border-warning/30 hover:border-warning/50",
		badgeVariant: "secondary" as const,
		animation: "",
	},
	critical: {
		borderClass: "border-error/40 hover:border-error/60",
		badgeVariant: "destructive" as const,
		animation: "animate-pulse",
	},
};

export function ProjectCard({
	name,
	team,
	cost,
	status,
	trend,
	actions = [],
	onClick,
	className,
}: ProjectCardProps) {
	const config = statusConfig[status];
	const isIncreasing = trend?.change.startsWith("+");

	return (
		<Card
			className={cn(
				"border-2 p-5 transition-all duration-200",
				config.borderClass,
				config.animation,
				onClick && "hover:-translate-y-1 cursor-pointer hover:shadow-lg",
				className,
			)}
			onClick={onClick}
		>
			<div className="space-y-4">
				{/* Header */}
				<div className="flex items-start justify-between">
					<div className="flex-1 space-y-1">
						<h3 className="font-semibold text-foreground text-lg leading-none">
							{name}
						</h3>
						<p className="text-muted-foreground text-sm">{team}</p>
					</div>
					<Badge variant={config.badgeVariant} className="ml-2">
						{status === "normal"
							? "정상"
							: status === "warning"
								? "주의"
								: "위험"}
					</Badge>
				</div>

				{/* Cost */}
				<div className="space-y-1">
					<p className="text-muted-foreground text-sm">현재 비용</p>
					<p className="font-bold font-mono text-3xl text-foreground">{cost}</p>
				</div>

				{/* Trend */}
				{trend && (
					<div className="flex items-center gap-2 text-sm">
						{isIncreasing ? (
							<TrendingUp className="h-4 w-4 text-error" />
						) : (
							<TrendingDown className="h-4 w-4 text-success" />
						)}
						<span className={isIncreasing ? "text-error" : "text-success"}>
							{trend.change}
						</span>
						<span className="text-muted-foreground">
							(이전: {trend.previous})
						</span>
					</div>
				)}

				{/* Actions */}
				{actions.length > 0 && (
					<div className="flex items-center gap-2 border-t pt-2">
						{actions.map((action) => (
							<Button
								key={action.label}
								variant="ghost"
								size="sm"
								onClick={(e) => {
									e.stopPropagation();
									action.onClick();
								}}
								className="flex items-center gap-2"
							>
								<action.icon className="h-4 w-4" />
								{action.label}
							</Button>
						))}
					</div>
				)}
			</div>
		</Card>
	);
}
