"use client";

import { CostChart, type CostDataPoint } from "@/components/custom";
import { StatCard } from "@/components/custom/stat-card";
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
import { ArrowLeft, DollarSign, Loader2, Save, TrendingUp } from "lucide-react";
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

	// Update metrics mutation
	const updateMetrics = api.project.updateMetrics.useMutation({
		onSuccess: () => {
			toast.success("성과 메트릭이 업데이트되었습니다");
			// Refetch project data
			void api.useUtils().project.getById.invalidate({ id: projectId });
		},
		onError: (error) => {
			toast.error("성과 메트릭 업데이트 실패", {
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
		? Object.entries(project.costByTaskType).map(([taskType, cost]) => ({
				timestamp: taskType,
				value: cost,
				label: formatCurrency(cost),
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
		</div>
	);
}
