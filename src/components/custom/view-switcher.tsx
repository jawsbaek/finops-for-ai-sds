"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BarChart3, LayoutDashboard } from "lucide-react";

export type ViewType = "executive" | "power-user";

export interface ViewSwitcherProps {
	currentView: ViewType;
	onChange: (view: ViewType) => void;
	className?: string;
}

export function ViewSwitcher({
	currentView,
	onChange,
	className,
}: ViewSwitcherProps) {
	return (
		<div
			className={cn(
				"inline-flex items-center gap-1 rounded-lg bg-muted p-1",
				className,
			)}
		>
			<Button
				variant={currentView === "executive" ? "default" : "ghost"}
				size="sm"
				onClick={() => onChange("executive")}
				className={cn(
					"gap-2 transition-all",
					currentView === "executive" &&
						"bg-primary text-primary-foreground hover:bg-primary/90",
				)}
			>
				<LayoutDashboard className="h-4 w-4" />
				<span>경영진 뷰</span>
			</Button>
			<Button
				variant={currentView === "power-user" ? "default" : "ghost"}
				size="sm"
				onClick={() => onChange("power-user")}
				className={cn(
					"gap-2 transition-all",
					currentView === "power-user" &&
						"bg-primary text-primary-foreground hover:bg-primary/90",
				)}
			>
				<BarChart3 className="h-4 w-4" />
				<span>파워 유저 뷰</span>
			</Button>
		</div>
	);
}
