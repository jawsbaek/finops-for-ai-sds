/**
 * Loading UI for Projects page
 * Shows a neutral loading spinner while server data is being fetched
 *
 * Note: We intentionally show a simple spinner instead of skeleton cards
 * to avoid creating false expectations when there might be no projects.
 */
export default function ProjectsLoading() {
	return (
		<div className="space-y-6">
			{/* Header Skeleton */}
			<div className="flex items-center justify-between">
				<div className="space-y-2">
					<div className="h-8 w-32 animate-pulse rounded-md bg-muted" />
					<div className="h-4 w-96 animate-pulse rounded-md bg-muted" />
				</div>
				<div className="h-10 w-32 animate-pulse rounded-md bg-muted" />
			</div>

			{/* Centered Loading Spinner */}
			<div className="flex min-h-[400px] items-center justify-center">
				<div className="flex flex-col items-center gap-3">
					<div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
					<p className="text-muted-foreground text-sm">
						프로젝트 정보를 불러오는 중...
					</p>
				</div>
			</div>
		</div>
	);
}
