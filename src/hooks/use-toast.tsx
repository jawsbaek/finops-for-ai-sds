/**
 * Toast hook using Sonner
 */

import { toast as sonnerToast } from "sonner";

export function useToast() {
	return {
		toast: (options: {
			title: string;
			description?: string;
			variant?: "default" | "destructive";
		}) => {
			const message = options.description
				? `${options.title}: ${options.description}`
				: options.title;

			if (options.variant === "destructive") {
				sonnerToast.error(options.title, {
					description: options.description,
				});
			} else {
				sonnerToast.success(options.title, {
					description: options.description,
				});
			}
		},
	};
}
