"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Loader2, Plus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "~/trpc/react";

export default function TeamsPage() {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [budget, setBudget] = useState("");

	// Fetch teams data
	const { data: teams, isLoading } = api.team.getAll.useQuery();

	// Get utils at component top level
	const utils = api.useUtils();

	// Create team mutation
	const createTeam = api.team.create.useMutation({
		onSuccess: (team) => {
			toast.success("팀이 생성되었습니다");
			setOpen(false);
			setName("");
			setBudget("");
			// Refetch teams
			void utils.team.getAll.invalidate();
			// Navigate to team detail
			router.push(`/teams/${team.id}`);
		},
		onError: (error) => {
			toast.error("팀 생성 실패", {
				description: error.message,
			});
		},
	});

	const handleCreateTeam = () => {
		if (!name.trim()) {
			toast.error("팀명을 입력해주세요");
			return;
		}

		const budgetValue = budget.trim() ? Number.parseFloat(budget) : undefined;
		if (
			budgetValue !== undefined &&
			(Number.isNaN(budgetValue) || budgetValue <= 0)
		) {
			toast.error("유효한 예산을 입력해주세요");
			return;
		}

		createTeam.mutate({
			name: name.trim(),
			budget: budgetValue,
		});
	};

	// Format currency
	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("ko-KR", {
			style: "currency",
			currency: "USD",
		}).format(amount);
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="font-bold text-2xl text-foreground">팀 관리</h2>
					<p className="mt-2 text-muted-foreground text-sm">
						팀별로 API 키를 관리하고 비용을 추적합니다
					</p>
				</div>

				{/* Create Team Button */}
				<Dialog open={open} onOpenChange={setOpen}>
					<DialogTrigger asChild>
						<Button>
							<Plus className="mr-2 h-4 w-4" />새 팀 생성
						</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>새 팀 생성</DialogTitle>
							<DialogDescription>
								팀을 생성하고 API 키를 관리하세요
							</DialogDescription>
						</DialogHeader>
						<div className="grid gap-4 py-4">
							<div className="grid gap-2">
								<Label htmlFor="name">
									팀명 <span className="text-destructive">*</span>
								</Label>
								<Input
									id="name"
									placeholder="예: AI 개발팀"
									value={name}
									onChange={(e) => setName(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											handleCreateTeam();
										}
									}}
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="budget">월 예산 (USD, 선택)</Label>
								<Input
									id="budget"
									type="number"
									placeholder="1000"
									value={budget}
									onChange={(e) => setBudget(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											handleCreateTeam();
										}
									}}
								/>
							</div>
						</div>
						<DialogFooter>
							<Button
								variant="outline"
								onClick={() => setOpen(false)}
								disabled={createTeam.isPending}
							>
								취소
							</Button>
							<Button
								onClick={handleCreateTeam}
								disabled={createTeam.isPending || !name.trim()}
							>
								{createTeam.isPending && (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								)}
								생성
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>

			{/* Teams Grid */}
			{isLoading ? (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{[1, 2, 3].map((i) => (
						<Card
							key={i}
							className="animate-pulse cursor-pointer transition-all hover:border-primary"
						>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Users className="h-5 w-5" />
									<span className="h-6 w-32 rounded bg-muted" />
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="space-y-2">
									<div className="h-4 w-24 rounded bg-muted" />
									<div className="h-4 w-20 rounded bg-muted" />
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			) : teams && teams.length > 0 ? (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{teams.map((team) => {
						return (
							<Card
								key={team.id}
								className="cursor-pointer transition-all hover:border-primary"
								onClick={() => router.push(`/teams/${team.id}`)}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault();
										router.push(`/teams/${team.id}`);
									}
								}}
								role="button"
								tabIndex={0}
							>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<Users className="h-5 w-5 text-primary" />
										{team.name}
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="space-y-2 text-sm">
										<div className="flex items-center justify-between">
											<span className="text-muted-foreground">멤버</span>
											<span className="font-medium">{team.memberCount}명</span>
										</div>
										<div className="flex items-center justify-between">
											<span className="text-muted-foreground">API 키</span>
											<span className="font-medium">{team.apiKeyCount}개</span>
										</div>
										{team.budget && (
											<div className="flex items-center justify-between">
												<span className="text-muted-foreground">월 예산</span>
												<span className="font-medium">
													{formatCurrency(team.budget)}
												</span>
											</div>
										)}
										<div className="flex items-center justify-between">
											<span className="text-muted-foreground">역할</span>
											<span className="font-medium">
												{team.role === "owner"
													? "소유자"
													: team.role === "admin"
														? "관리자"
														: "멤버"}
											</span>
										</div>
									</div>
								</CardContent>
							</Card>
						);
					})}
				</div>
			) : (
				<div className="flex flex-col items-center justify-center rounded-lg border border-border border-dashed py-12">
					<Users className="mb-4 h-12 w-12 text-muted-foreground" />
					<p className="text-center text-muted-foreground">
						아직 생성된 팀이 없습니다
					</p>
					<p className="mt-2 text-center text-muted-foreground text-sm">
						새 팀을 생성하여 API 키를 관리하고 비용을 추적하세요
					</p>
					<Button className="mt-4" onClick={() => setOpen(true)}>
						<Plus className="mr-2 h-4 w-4" />첫 팀 생성
					</Button>
				</div>
			)}
		</div>
	);
}
