"use client";

import { Badge } from "@/components/ui/badge";
import { Brain, Cloud, Sparkles, Zap } from "lucide-react";

interface ProviderBadgeProps {
	provider: string;
	size?: "sm" | "md" | "lg";
	showLabel?: boolean;
}

/**
 * Provider Badge Component
 *
 * Displays provider icon + name with consistent styling
 */
export function ProviderBadge({
	provider,
	size = "md",
	showLabel = false,
}: ProviderBadgeProps) {
	const getProviderConfig = (p: string) => {
		switch (p.toLowerCase()) {
			case "openai":
				return {
					icon: Sparkles,
					label: "OpenAI",
					className:
						"bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
				};
			case "anthropic":
				return {
					icon: Brain,
					label: "Anthropic",
					className:
						"bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
				};
			case "aws":
				return {
					icon: Cloud,
					label: "AWS",
					className:
						"bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
				};
			case "azure":
				return {
					icon: Zap,
					label: "Azure",
					className:
						"bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
				};
			default:
				return {
					icon: Cloud,
					label: p,
					className:
						"bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300",
				};
		}
	};

	const iconSize = {
		sm: "h-3 w-3",
		md: "h-4 w-4",
		lg: "h-5 w-5",
	};

	const config = getProviderConfig(provider);
	const Icon = config.icon;

	if (showLabel) {
		return (
			<Badge variant="outline" className={config.className}>
				<Icon className={`${iconSize[size]} mr-1`} />
				{config.label}
			</Badge>
		);
	}

	return <Icon className={`${iconSize[size]} ${config.className}`} />;
}
