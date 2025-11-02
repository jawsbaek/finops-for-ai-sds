"use client";

import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { useEffect } from "react";

/**
 * Error Boundary for Projects Page
 * Catches errors from Server Components and provides recovery UI
 */
export default function ProjectsError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		// Log error to console (production logs will capture this)
		console.error("[ProjectsPage] Error boundary caught:", error);
	}, [error]);

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h2 className="font-bold text-2xl text-foreground">프로젝트</h2>
				<p className="mt-2 text-muted-foreground text-sm">
					AI 비용을 프로젝트별로 추적하고 효율성을 분석합니다
				</p>
			</div>

			{/* Error Display */}
			<div className="flex min-h-[400px] items-center justify-center">
				<div className="max-w-md space-y-4 text-center">
					<div className="flex justify-center">
						<div className="rounded-full bg-destructive/10 p-3">
							<AlertCircle className="h-10 w-10 text-destructive" />
						</div>
					</div>
					<div className="space-y-2">
						<h3 className="font-semibold text-foreground text-lg">
							프로젝트를 불러올 수 없습니다
						</h3>
						<p className="text-muted-foreground text-sm">
							일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
						</p>
						{process.env.NODE_ENV === "development" && error.message && (
							<details className="mt-4 rounded-lg border border-border bg-muted p-3 text-left">
								<summary className="cursor-pointer font-medium text-sm">
									개발자 정보
								</summary>
								<pre className="mt-2 overflow-auto text-xs">
									{error.message}
									{error.digest && `\n\nDigest: ${error.digest}`}
								</pre>
							</details>
						)}
					</div>
					<div className="flex justify-center gap-2">
						<Button onClick={() => reset()} variant="default">
							다시 시도
						</Button>
						<Button onClick={() => window.location.reload()} variant="outline">
							페이지 새로고침
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
