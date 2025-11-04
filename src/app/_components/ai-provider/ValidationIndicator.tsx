"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

interface ValidationIndicatorProps {
	status: "idle" | "validating" | "valid" | "invalid";
	error?: string;
}

/**
 * Validation Indicator Component
 *
 * Shows validation status with spinner, checkmark, or error icon
 */
export function ValidationIndicator({
	status,
	error,
}: ValidationIndicatorProps) {
	if (status === "idle") {
		return null;
	}

	if (status === "validating") {
		return (
			<Alert data-testid="validation-indicator" data-status="validating">
				<Loader2 className="h-4 w-4 animate-spin" />
				<AlertDescription>Checking with provider API...</AlertDescription>
			</Alert>
		);
	}

	if (status === "valid") {
		return (
			<Alert
				data-testid="validation-indicator"
				data-status="valid"
				className="border-success/20 bg-success/10 dark:border-success/20 dark:bg-success/10"
			>
				<CheckCircle2 className="h-4 w-4 text-success" />
				<AlertDescription className="text-success">
					✓ Project ID validated successfully
				</AlertDescription>
			</Alert>
		);
	}

	// status === "invalid"
	return (
		<Alert
			data-testid="validation-indicator"
			data-status="invalid"
			variant="destructive"
		>
			<XCircle className="h-4 w-4" />
			<AlertDescription data-testid="validation-error">
				✗ {error ?? "Invalid project ID or insufficient permissions"}
			</AlertDescription>
		</Alert>
	);
}
