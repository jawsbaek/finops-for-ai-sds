"use client";

import { CostChart, type CostDataPoint } from "@/components/custom";
import { StatCard } from "@/components/custom/stat-card";
import { AddApiKeyDialog } from "@/components/dialogs/AddApiKeyDialog";
import { AddMemberDialog } from "@/components/dialogs/AddMemberDialog";
import { ConfirmDeleteKeyDialog } from "@/components/dialogs/ConfirmDeleteKeyDialog";
import { ConfirmDisableKeyDialog } from "@/components/dialogs/ConfirmDisableKeyDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	ArrowLeft,
	DollarSign,
	Key,
	Loader2,
	RotateCcw,
	Save,
	ShieldAlert,
	Trash2,
	TrendingUp,
	UserPlus,
	Users,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "~/trpc/react";

export default function ProjectDetailPage() {
	const params = useParams();
	const projectId = params.id as string;

	// Fetch project details
	const { data: project, isLoading } = api.project.getById.useQuery({
		id: projectId,
	});

	// State for metrics form
	const [successCount, setSuccessCount] = useState<string>("");
	const [feedbackScore, setFeedbackScore] = useState<string>("");

	// State for API key dialogs
	const [addApiKeyDialogOpen, setAddApiKeyDialogOpen] = useState(false);
	const [apiKeyServerError, setApiKeyServerError] = useState<
		string | undefined
	>(undefined);
	const [disableDialogOpen, setDisableDialogOpen] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [selectedApiKeyId, setSelectedApiKeyId] = useState<string | null>(null);
	const [selectedApiKeyLast4, setSelectedApiKeyLast4] = useState<
		string | undefined
	>(undefined);

	// State for member dialog
	const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);

	// Get utils at component top level
	const utils = api.useUtils();

	// Update metrics mutation
	const updateMetrics = api.project.updateMetrics.useMutation({
		onSuccess: () => {
			toast.success("성과 메트릭이 업데이트되었습니다");
			// Refetch project data
			void utils.project.getById.invalidate({ id: projectId });
		},
		onError: (error) => {
			toast.error("성과 메트릭 업데이트 실패", {
				description: error.message,
			});
		},
	});

	// Get project members
	const { data: projectMembers } = api.project.getMembers.useQuery({
		projectId,
	});

	// Get team members for add member dropdown
	const { data: teamMembers } = api.team.getMembers.useQuery(
		{
			teamId: project?.team.id ?? "",
		},
		{
			enabled: !!project?.team.id,
		},
	);

	// Add member mutation
	const addMember = api.project.addMember.useMutation({
		onSuccess: () => {
			toast.success("멤버가 추가되었습니다");
			setAddMemberDialogOpen(false);
			void utils.project.getMembers.invalidate({ projectId });
		},
		onError: (error) => {
			toast.error("멤버 추가 실패", {
				description: error.message,
			});
		},
	});

	// Remove member mutation
	const removeMember = api.project.removeMember.useMutation({
		onSuccess: () => {
			toast.success("멤버가 제거되었습니다");
			void utils.project.getMembers.invalidate({ projectId });
		},
		onError: (error) => {
			toast.error("멤버 제거 실패", {
				description: error.message,
			});
		},
	});

	// Generate API key mutation
	const generateApiKey = api.project.generateApiKey.useMutation({
		onMutate: () => {
			// Clear previous error before mutation starts (prevents race conditions)
			setApiKeyServerError(undefined);
		},
		onSuccess: () => {
			toast.success("API 키가 추가되었습니다", {
				description: "API 키가 안전하게 암호화되어 저장되었습니다",
			});
			setAddApiKeyDialogOpen(false);
			void utils.project.getById.invalidate({ id: projectId });
		},
		onError: (error) => {
			// Show error in dialog instead of toast so user can see it
			setApiKeyServerError(error.message);
		},
	});

	// Disable API key mutation
	const disableApiKey = api.project.disableApiKey.useMutation({
		onSuccess: () => {
			toast.success("API 키가 비활성화되었습니다", {
				description: "이 키를 사용하는 모든 요청이 차단됩니다",
			});
			setDisableDialogOpen(false);
			setSelectedApiKeyId(null);
			setSelectedApiKeyLast4(undefined);
			void utils.project.getById.invalidate({ id: projectId });
		},
		onError: (error) => {
			toast.error("API 키 비활성화 실패", {
				description: error.message,
			});
		},
	});

	// Enable API key mutation
	const enableApiKey = api.project.enableApiKey.useMutation({
		onSuccess: () => {
			toast.success("API 키가 재활성화되었습니다");
			void utils.project.getById.invalidate({ id: projectId });
		},
		onError: (error) => {
			toast.error("API 키 재활성화 실패", {
				description: error.message,
			});
		},
	});

	// Delete API key mutation
	const deleteApiKey = api.project.deleteApiKey.useMutation({
		onSuccess: () => {
			toast.success("API 키가 영구 삭제되었습니다");
			setDeleteDialogOpen(false);
			setSelectedApiKeyId(null);
			setSelectedApiKeyLast4(undefined);
			void utils.project.getById.invalidate({ id: projectId });
		},
		onError: (error) => {
			toast.error("API 키 삭제 실패", {
				description: error.message,
			});
		},
	});

	// Handle metrics form submission
	const handleUpdateMetrics = () => {
		const count = Number.parseInt(successCount, 10);
		const score = feedbackScore ? Number.parseFloat(feedbackScore) : undefined;

		if (Number.isNaN(count) || count < 0) {
			toast.error("올바른 성공 작업 수를 입력해주세요");
			return;
		}

		if (
			score !== undefined &&
			(Number.isNaN(score) || score < 1 || score > 5)
		) {
			toast.error("피드백 점수는 1-5 사이여야 합니다");
			return;
		}

		updateMetrics.mutate({
			projectId,
			successCount: count,
			feedbackScore: score,
		});
	};

	// Handle disable API key
	const handleOpenDisableDialog = (apiKeyId: string, last4: string) => {
		setSelectedApiKeyId(apiKeyId);
		setSelectedApiKeyLast4(last4);
		setDisableDialogOpen(true);
	};

	const handleConfirmDisable = (reason: string) => {
		if (!selectedApiKeyId) return;

		disableApiKey.mutate({
			apiKeyId: selectedApiKeyId,
			reason,
		});
	};

	// Handle enable API key
	const handleEnableApiKey = (apiKeyId: string) => {
		enableApiKey.mutate({
			apiKeyId,
			reason: "API key re-enabled from project dashboard",
		});
	};

	// Handle open delete API key dialog
	const handleOpenDeleteDialog = (apiKeyId: string, last4: string) => {
		setSelectedApiKeyId(apiKeyId);
		setSelectedApiKeyLast4(last4);
		setDeleteDialogOpen(true);
	};

	// Handle confirm delete API key
	const handleConfirmDelete = (reason: string) => {
		if (!selectedApiKeyId) return;

		deleteApiKey.mutate({
			apiKeyId: selectedApiKeyId,
			reason,
		});
	};

	// Handle add API key
	const handleAddApiKey = (provider: "openai", apiKey: string) => {
		generateApiKey.mutate({
			projectId,
			provider,
			apiKey,
		});
	};

	// Handle API key dialog open change
	const handleAddApiKeyDialogOpenChange = (open: boolean) => {
		setAddApiKeyDialogOpen(open);
		// Clear server error when dialog opens/closes
		if (!open) {
			setApiKeyServerError(undefined);
		}
	};

	// Handle add member
	const handleAddMember = (userId: string) => {
		addMember.mutate({
			projectId,
			userId,
		});
	};

	// Handle remove member
	const handleRemoveMember = (userId: string, userName: string) => {
		if (confirm(`정말로 ${userName}님을 프로젝트에서 제거하시겠습니까?`)) {
			removeMember.mutate({
				projectId,
				userId,
			});
		}
	};

	// Format currency
	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("ko-KR", {
			style: "currency",
			currency: "USD",
		}).format(amount);
	};

	// Transform cost-value data for chart
	const costValueChartData: CostDataPoint[] =
		project?.costValueData.map((item) => ({
			timestamp: item.date,
			value: item.cost,
			label: formatCurrency(item.cost),
		})) || [];

	// Transform task type breakdown for chart
	const taskTypeChartData: CostDataPoint[] = project?.costByTaskType
		? Object.entries(project.costByTaskType).map(([taskType, cost], index) => ({
				timestamp: new Date(2025, 0, index + 1), // Valid date for chart compatibility
				value: cost,
				label: formatCurrency(cost),
				name: taskType, // Override formatted date with task type label
			}))
		: [];

	// Calculate efficiency display
	const efficiencyDisplay = project?.efficiency
		? `${project.efficiency.toFixed(2)} 작업/$`
		: "데이터 없음";

	if (isLoading) {
		return (
			<div className="space-y-6">
				{/* Header Skeleton */}
				<div className="flex items-center gap-4">
					<div className="h-10 w-10 animate-pulse rounded bg-muted" />
					<div className="space-y-2">
						<div className="h-6 w-48 animate-pulse rounded bg-muted" />
						<div className="h-4 w-32 animate-pulse rounded bg-muted" />
					</div>
				</div>

				{/* Stats Skeleton */}
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<StatCard label="" value="" loading />
					<StatCard label="" value="" loading />
					<StatCard label="" value="" loading />
				</div>

				{/* Charts Skeleton */}
				<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
					<Card className="h-96 animate-pulse bg-muted" />
					<Card className="h-96 animate-pulse bg-muted" />
				</div>
			</div>
		);
	}

	if (!project) {
		return (
			<div className="flex flex-col items-center justify-center py-12">
				<p className="text-center text-muted-foreground">
					프로젝트를 찾을 수 없습니다
				</p>
				<Link href="/projects" className="mt-4 text-primary hover:underline">
					프로젝트 목록으로 돌아가기
				</Link>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-start justify-between">
				<div className="flex items-center gap-4">
					<Link
						href="/projects"
						className="rounded-lg p-2 transition-colors hover:bg-muted"
					>
						<ArrowLeft className="h-5 w-5 text-foreground" />
					</Link>
					<div>
						<h2 className="font-bold text-2xl text-foreground">
							{project.name}
						</h2>
						<p className="mt-1 text-muted-foreground text-sm">
							{project.team.name}
							{project.description && ` • ${project.description}`}
						</p>
					</div>
				</div>
			</div>

			{/* Stats Overview */}
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{/* Total Cost */}
				<StatCard
					label="총 비용 (최근 30일)"
					value={formatCurrency(project.totalCost)}
					icon={<DollarSign className="h-5 w-5" />}
					variant="primary"
				/>

				{/* Efficiency */}
				<StatCard
					label="비용 대비 성과"
					value={efficiencyDisplay}
					icon={<TrendingUp className="h-5 w-5" />}
					variant={
						project.efficiency && project.efficiency >= 10
							? "success"
							: project.efficiency && project.efficiency >= 5
								? "warning"
								: "error"
					}
				/>

				{/* Success Count */}
				<StatCard
					label="성공한 작업"
					value={project.metrics?.successCount || 0}
					variant="primary"
				/>
			</div>

			{/* Project Members Section */}
			<Card className="p-6">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<Users className="h-5 w-5 text-primary" />
						<div>
							<h3 className="font-semibold text-foreground text-lg">
								프로젝트 멤버
							</h3>
							<p className="mt-1 text-muted-foreground text-sm">
								프로젝트에 참여하는 팀 멤버를 관리합니다
							</p>
						</div>
					</div>
					<Button
						onClick={() => setAddMemberDialogOpen(true)}
						disabled={addMember.isPending}
					>
						<UserPlus className="mr-2 h-4 w-4" />
						멤버 추가
					</Button>
				</div>

				{projectMembers && projectMembers.length > 0 ? (
					<div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
						{projectMembers.map((member) => (
							<div
								key={member.id}
								className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
							>
								<div className="space-y-1">
									<p className="font-medium text-foreground text-sm">
										{member.user.name || member.user.email}
									</p>
									<p className="text-muted-foreground text-xs">
										{member.user.email}
									</p>
									<p className="text-muted-foreground text-xs">
										가입일:{" "}
										{new Date(member.createdAt).toLocaleDateString("ko-KR")}
									</p>
								</div>
								<Button
									variant="ghost"
									size="sm"
									onClick={() =>
										handleRemoveMember(
											member.userId,
											member.user.name || member.user.email,
										)
									}
									disabled={removeMember.isPending}
									className="text-destructive hover:text-destructive"
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</div>
						))}
					</div>
				) : (
					<div className="mt-6 flex flex-col items-center justify-center rounded-lg border border-border border-dashed py-12">
						<Users className="mb-3 h-10 w-10 text-muted-foreground" />
						<p className="text-center text-muted-foreground text-sm">
							아직 프로젝트 멤버가 없습니다
						</p>
					</div>
				)}
			</Card>

			{/* API Keys Management Section */}
			<Card className="p-6">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<Key className="h-5 w-5 text-primary" />
						<div>
							<h3 className="font-semibold text-foreground text-lg">
								API 키 관리
							</h3>
							<p className="mt-1 text-muted-foreground text-sm">
								프로젝트의 API 키를 추가하고 관리합니다
							</p>
						</div>
					</div>
					<Button
						data-testid="add-api-key-button"
						onClick={() => setAddApiKeyDialogOpen(true)}
						disabled={generateApiKey.isPending}
					>
						<Key className="mr-2 h-4 w-4" />
						API 키 추가
					</Button>
				</div>

				{project.apiKeys && project.apiKeys.length > 0 ? (
					<div className="mt-6 space-y-3">
						{project.apiKeys.map((apiKey) => (
							<div
								key={apiKey.id}
								className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
							>
								<div className="space-y-1">
									<div className="flex items-center gap-2">
										<p className="font-medium text-foreground text-sm capitalize">
											{apiKey.provider} API Key
										</p>
										{apiKey.isActive ? (
											<span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 font-medium text-success text-xs">
												<span className="h-1.5 w-1.5 rounded-full bg-success" />
												활성
											</span>
										) : (
											<span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground text-xs">
												<span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
												비활성
											</span>
										)}
									</div>
									<p className="font-mono text-muted-foreground text-xs">
										키: ...{apiKey.last4}
									</p>
									<p className="text-muted-foreground text-xs">
										생성일:{" "}
										{new Date(apiKey.createdAt).toLocaleDateString("ko-KR", {
											year: "numeric",
											month: "long",
											day: "numeric",
										})}
									</p>
								</div>
								<div className="flex items-center gap-2">
									{apiKey.isActive ? (
										<Button
											variant="destructive"
											size="sm"
											onClick={() =>
												handleOpenDisableDialog(apiKey.id, apiKey.last4)
											}
											disabled={disableApiKey.isPending}
										>
											<ShieldAlert className="mr-2 h-4 w-4" />
											비활성화
										</Button>
									) : (
										<Button
											variant="default"
											size="sm"
											onClick={() => handleEnableApiKey(apiKey.id)}
											disabled={enableApiKey.isPending}
										>
											<RotateCcw className="mr-2 h-4 w-4" />
											재활성화
										</Button>
									)}
									<Button
										variant="ghost"
										size="sm"
										onClick={() =>
											handleOpenDeleteDialog(apiKey.id, apiKey.last4)
										}
										disabled={deleteApiKey.isPending}
										className="text-destructive hover:text-destructive"
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</div>
							</div>
						))}
					</div>
				) : (
					<div className="mt-6 flex flex-col items-center justify-center rounded-lg border border-border border-dashed py-12">
						<Key className="mb-3 h-10 w-10 text-muted-foreground" />
						<p className="text-center text-muted-foreground text-sm">
							등록된 API 키가 없습니다
						</p>
					</div>
				)}

				{/* Information */}
				<div className="mt-6 rounded-lg border border-border bg-muted p-4">
					<p className="font-semibold text-foreground text-sm">참고사항</p>
					<ul className="mt-2 ml-4 list-disc space-y-1 text-muted-foreground text-xs">
						<li>API 키는 암호화되어 안전하게 저장됩니다</li>
						<li>
							API 키 비활성화 시 이 키를 사용하는 모든 애플리케이션이 즉시
							중단됩니다
						</li>
						<li>비활성화 및 삭제 이벤트는 감사 로그에 자동으로 기록됩니다</li>
					</ul>
				</div>
			</Card>

			{/* Charts Grid */}
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
				{/* Cost Trend Chart */}
				<div className="space-y-2">
					<h3 className="font-semibold text-foreground text-lg">비용 추이</h3>
					<p className="text-muted-foreground text-sm">
						최근 30일간 일별 비용 변화
					</p>
					{costValueChartData.length > 0 ? (
						<CostChart data={costValueChartData} type="trend" />
					) : (
						<Card className="flex h-96 items-center justify-center">
							<p className="text-center text-muted-foreground">
								아직 비용 데이터가 없습니다
							</p>
						</Card>
					)}
				</div>

				{/* Task Type Breakdown Chart */}
				<div className="space-y-2">
					<h3 className="font-semibold text-foreground text-lg">
						작업 유형별 비용 분포
					</h3>
					<p className="text-muted-foreground text-sm">
						작업 유형에 따른 비용 비교
					</p>
					{taskTypeChartData.length > 0 ? (
						<CostChart data={taskTypeChartData} type="comparison" />
					) : (
						<Card className="flex h-96 items-center justify-center">
							<p className="text-center text-muted-foreground">
								아직 작업 유형 데이터가 없습니다
							</p>
						</Card>
					)}
				</div>
			</div>

			{/* Performance Metrics Section - Editable */}
			<Card className="p-6">
				<div className="flex items-center justify-between">
					<h3 className="font-semibold text-foreground text-lg">
						성과 메트릭 업데이트
					</h3>
				</div>
				<p className="mt-2 text-muted-foreground text-sm">
					프로젝트의 성과 지표를 입력하여 비용 대비 효율성을 추적하세요
				</p>

				<div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
					{/* Success Count Input */}
					<div className="space-y-2">
						<Label htmlFor="successCount">
							성공한 작업 수 <span className="text-error">*</span>
						</Label>
						<Input
							id="successCount"
							type="number"
							min="0"
							placeholder={
								project.metrics
									? String(project.metrics.successCount)
									: "예: 100"
							}
							value={successCount}
							onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
								setSuccessCount(e.target.value)
							}
						/>
						<p className="text-muted-foreground text-xs">
							현재: {project.metrics ? project.metrics.successCount : 0}
						</p>
					</div>

					{/* Feedback Score Select */}
					<div className="space-y-2">
						<Label htmlFor="feedbackScore">사용자 피드백 점수 (선택)</Label>
						<Select value={feedbackScore} onValueChange={setFeedbackScore}>
							<SelectTrigger id="feedbackScore">
								<SelectValue
									placeholder={
										project.metrics?.feedbackScore
											? `현재: ${project.metrics.feedbackScore.toFixed(1)} / 5.0`
											: "점수 선택"
									}
								/>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="1">1.0 - 매우 나쁨</SelectItem>
								<SelectItem value="2">2.0 - 나쁨</SelectItem>
								<SelectItem value="3">3.0 - 보통</SelectItem>
								<SelectItem value="4">4.0 - 좋음</SelectItem>
								<SelectItem value="5">5.0 - 매우 좋음</SelectItem>
							</SelectContent>
						</Select>
						<p className="text-muted-foreground text-xs">
							현재:{" "}
							{project.metrics?.feedbackScore
								? `${project.metrics.feedbackScore.toFixed(1)} / 5.0`
								: "미설정"}
						</p>
					</div>
				</div>

				{/* Submit Button */}
				<div className="mt-6 flex justify-end">
					<Button
						onClick={handleUpdateMetrics}
						disabled={updateMetrics.isPending || !successCount.trim()}
					>
						{updateMetrics.isPending && (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						)}
						<Save className="mr-2 h-4 w-4" />
						업데이트
					</Button>
				</div>
			</Card>

			{/* Dialogs */}
			<AddMemberDialog
				open={addMemberDialogOpen}
				onOpenChange={setAddMemberDialogOpen}
				onConfirm={handleAddMember}
				isLoading={addMember.isPending}
				teamMembers={teamMembers || []}
				existingMemberUserIds={projectMembers?.map((m) => m.userId) || []}
			/>

			<AddApiKeyDialog
				open={addApiKeyDialogOpen}
				onOpenChange={handleAddApiKeyDialogOpenChange}
				onConfirm={handleAddApiKey}
				isLoading={generateApiKey.isPending}
				serverError={apiKeyServerError}
			/>

			<ConfirmDisableKeyDialog
				open={disableDialogOpen}
				onOpenChange={setDisableDialogOpen}
				onConfirm={handleConfirmDisable}
				isLoading={disableApiKey.isPending}
				apiKeyLast4={selectedApiKeyLast4}
			/>

			<ConfirmDeleteKeyDialog
				open={deleteDialogOpen}
				onOpenChange={setDeleteDialogOpen}
				onConfirm={handleConfirmDelete}
				isLoading={deleteApiKey.isPending}
				apiKeyLast4={selectedApiKeyLast4}
			/>
		</div>
	);
}
