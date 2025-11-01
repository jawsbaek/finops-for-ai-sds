"use client";

import { ProjectCard } from "@/components/custom";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "~/trpc/react";

export default function ProjectsPage() {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");

	// Fetch projects data
	const { data: projects, isLoading } = api.project.getAll.useQuery();

	// Get utils at component top level
	const utils = api.useUtils();

	// Create project mutation
	const createProject = api.project.create.useMutation({
		onSuccess: (project) => {
			toast.success("프로젝트가 생성되었습니다");
			setOpen(false);
			setName("");
			setDescription("");
			// Refetch projects
			void utils.project.getAll.invalidate();
			// Navigate to project detail
			router.push(`/projects/${project.id}`);
		},
		onError: (error) => {
			toast.error("프로젝트 생성 실패", {
				description: error.message,
			});
		},
	});

	// Get user's teams for project creation
	// For MVP, we'll use the first team the user belongs to
	// In production, allow user to select team
	const { data: currentUser } = api.auth.getMe.useQuery();
	const firstTeamId = currentUser?.teamMemberships?.[0]?.teamId ?? "";

	const handleCreateProject = () => {
		if (!name.trim()) {
			toast.error("프로젝트명을 입력해주세요");
			return;
		}

		if (!firstTeamId) {
			toast.error("팀 정보를 찾을 수 없습니다");
			return;
		}

		createProject.mutate({
			name: name.trim(),
			description: description.trim() || undefined,
			teamId: firstTeamId,
		});
	};

	// Format currency
	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("ko-KR", {
			style: "currency",
			currency: "USD",
		}).format(amount);
	};

	// Determine status based on efficiency only (costData not available in getAll)
	const getProjectStatus = (
		efficiency: number | null,
	): "normal" | "warning" | "critical" => {
		// Critical: Low efficiency (<5)
		if (efficiency !== null && efficiency < 5) return "critical";

		// Warning: Medium efficiency (5-10)
		if (efficiency !== null && efficiency < 10) return "warning";

		return "normal";
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="font-bold text-2xl text-foreground">프로젝트</h2>
					<p className="mt-2 text-muted-foreground text-sm">
						AI 비용을 프로젝트별로 추적하고 효율성을 분석합니다
					</p>
				</div>

				{/* Create Project Button */}
				<Dialog open={open} onOpenChange={setOpen}>
					<DialogTrigger asChild>
						<Button>
							<Plus className="mr-2 h-4 w-4" />새 프로젝트
						</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>새 프로젝트 생성</DialogTitle>
							<DialogDescription>
								프로젝트명을 입력하여 AI 비용을 추적하세요
							</DialogDescription>
						</DialogHeader>
						<div className="grid gap-4 py-4">
							<div className="grid gap-2">
								<Label htmlFor="name">
									프로젝트명 <span className="text-error">*</span>
								</Label>
								<Input
									id="name"
									placeholder="예: 고객 챗봇 프로젝트"
									value={name}
									onChange={(e) => setName(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											handleCreateProject();
										}
									}}
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="description">설명 (선택)</Label>
								<Textarea
									id="description"
									placeholder="프로젝트 설명을 입력하세요"
									value={description}
									onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
										setDescription(e.target.value)
									}
									rows={3}
								/>
							</div>
						</div>
						<DialogFooter>
							<Button
								variant="outline"
								onClick={() => setOpen(false)}
								disabled={createProject.isPending}
							>
								취소
							</Button>
							<Button
								onClick={handleCreateProject}
								disabled={createProject.isPending || !name.trim()}
							>
								{createProject.isPending && (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								)}
								생성
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>

			{/* Projects Grid */}
			{isLoading ? (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{[1, 2, 3].map((i) => (
						<ProjectCard
							key={i}
							name=""
							team=""
							cost=""
							status="normal"
							className="animate-pulse"
						/>
					))}
				</div>
			) : projects && projects.length > 0 ? (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{projects.map((project) => (
						<ProjectCard
							key={project.id}
							name={project.name}
							team={project.team.name}
							cost={formatCurrency(project.totalCost)}
							status={getProjectStatus(project.efficiency)}
							onClick={() => router.push(`/projects/${project.id}`)}
						/>
					))}
				</div>
			) : (
				<div className="flex flex-col items-center justify-center rounded-lg border border-border border-dashed py-12">
					<p className="text-center text-muted-foreground">
						아직 생성된 프로젝트가 없습니다
					</p>
					<p className="mt-2 text-center text-muted-foreground text-sm">
						새 프로젝트를 생성하여 AI 비용을 추적하세요
					</p>
					<Button className="mt-4" onClick={() => setOpen(true)}>
						<Plus className="mr-2 h-4 w-4" />첫 프로젝트 생성
					</Button>
				</div>
			)}
		</div>
	);
}
