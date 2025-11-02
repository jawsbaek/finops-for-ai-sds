"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { useEffect } from "react";

/**
 * Root Error Boundary
 * Catches and handles errors at the application level
 */
export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		// Log error to error reporting service (e.g., Sentry)
		console.error("Application error:", error);
	}, [error]);

	return (
		<html lang="ko">
			<body>
				<div className="flex min-h-screen items-center justify-center bg-background p-4">
					<Card className="w-full max-w-md p-6">
						<div className="flex flex-col items-center space-y-4 text-center">
							<div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
								<AlertCircle className="h-6 w-6 text-destructive" />
							</div>

							<div className="space-y-2">
								<h1 className="font-semibold text-2xl text-foreground">
									문제가 발생했습니다
								</h1>
								<p className="text-muted-foreground text-sm">
									예상치 못한 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
								</p>
							</div>

							{process.env.NODE_ENV === "development" && error.message && (
								<Card className="w-full bg-muted p-4">
									<p className="text-left font-mono text-muted-foreground text-xs">
										{error.message}
									</p>
									{error.digest && (
										<p className="mt-2 text-left font-mono text-muted-foreground text-xs">
											Error ID: {error.digest}
										</p>
									)}
								</Card>
							)}

							<div className="flex w-full gap-2">
								<Button
									variant="outline"
									className="flex-1"
									onClick={() => {
										window.location.href = "/";
									}}
								>
									홈으로
								</Button>
								<Button className="flex-1" onClick={reset}>
									다시 시도
								</Button>
							</div>
						</div>
					</Card>
				</div>
			</body>
		</html>
	);
}
