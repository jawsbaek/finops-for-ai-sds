import type { Metadata } from "next";
import { HydrateClient, api } from "~/trpc/server";
import { ProjectListClient } from "./_components/project-list-client";

export const metadata: Metadata = {
	title: "프로젝트",
	description: "AI 비용을 프로젝트별로 추적하고 효율성을 분석",
};

// Next.js Cache Strategy
// Force dynamic rendering for user-scoped data to prevent caching user-specific responses
export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
	// Fetch data on the server
	const [projects, currentUser] = await Promise.all([
		api.project.getAll(),
		api.auth.getMe(),
	]);

	return (
		<HydrateClient>
			<div className="space-y-6">
				<ProjectListClient
					initialProjects={projects}
					currentUser={currentUser}
				/>
			</div>
		</HydrateClient>
	);
}
