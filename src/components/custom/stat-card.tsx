"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

const statCardVariants = cva(
	"relative overflow-hidden transition-all duration-200",
	{
		variants: {
			variant: {
				primary: "border-primary/20 hover:border-primary/40",
				success: "border-success/20 hover:border-success/40",
				warning: "border-warning/20 hover:border-warning/40",
				error: "border-error/20 hover:border-error/40",
			},
			size: {
				sm: "p-4",
				md: "p-5",
				lg: "p-6",
			},
			clickable: {
				true: "hover:-translate-y-1 cursor-pointer hover:shadow-lg",
				false: "",
			},
		},
		defaultVariants: {
			variant: "primary",
			size: "md",
			clickable: false,
		},
	},
);

const valueVariants = cva("font-bold font-mono", {
	variants: {
		size: {
			sm: "text-2xl",
			md: "text-3xl",
			lg: "text-4xl",
		},
	},
	defaultVariants: {
		size: "md",
	},
});

export interface StatCardProps
	extends Omit<React.HTMLAttributes<HTMLDivElement>, "onClick">,
		VariantProps<typeof statCardVariants> {
	label: string;
	value: string | number;
	change?: string;
	trend?: "up" | "down" | "neutral";
	icon?: ReactNode;
	loading?: boolean;
	onClick?: () => void;
}

export function StatCard({
	label,
	value,
	change,
	trend = "neutral",
	icon,
	variant = "primary",
	size = "md",
	loading = false,
	onClick,
	className,
	...props
}: StatCardProps) {
	const clickable = !!onClick;

	const trendIcon = {
		up: <TrendingUp className="h-4 w-4 text-success" />,
		down: <TrendingDown className="h-4 w-4 text-error" />,
		neutral: <Minus className="h-4 w-4 text-muted-foreground" />,
	}[trend];

	const trendColor = {
		up: "text-success",
		down: "text-error",
		neutral: "text-muted-foreground",
	}[trend];

	if (loading) {
		return (
			<Card
				className={cn(
					statCardVariants({ variant, size, clickable: false }),
					className,
				)}
			>
				<div className="animate-pulse space-y-3">
					<div className="h-4 w-24 rounded bg-muted" />
					<div className="h-8 w-32 rounded bg-muted" />
					{change && <div className="h-4 w-16 rounded bg-muted" />}
				</div>
			</Card>
		);
	}

	return (
		<Card
			className={cn(statCardVariants({ variant, size, clickable }), className)}
			onClick={onClick}
			{...props}
		>
			<div className="space-y-2">
				{/* Label with Icon */}
				<div className="flex items-center justify-between">
					<p className="font-medium text-muted-foreground text-sm">{label}</p>
					{icon && <div className="text-muted-foreground">{icon}</div>}
				</div>

				{/* Value */}
				<p className={cn(valueVariants({ size }), "text-foreground")}>
					{value}
				</p>

				{/* Change and Trend */}
				{change && (
					<div className="flex items-center gap-1">
						{trendIcon}
						<span className={cn("font-medium text-sm", trendColor)}>
							{change}
						</span>
					</div>
				)}
			</div>
		</Card>
	);
}
