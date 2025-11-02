"use client";

import { StatCard } from "@/components/custom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, DollarSign, FolderOpen, TrendingUp, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { api } from "~/trpc/react";

export default function DashboardPage() {
	const router = useRouter();

	// Fetch cost summary data with 5-minute cache
	const { data: costSummary, isLoading } = api.cost.getSummary.useQuery(
		{},
		{
			staleTime: 5 * 60 * 1000, // 5 minutes
			gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
		},
	);

	// Fetch team costs top 5 with 5-minute cache
	const { data: teamCosts, isLoading: isLoadingTeamCosts } =
		api.cost.getTeamCostsTopN.useQuery(
			{
				limit: 5,
				days: 7,
			},
			{
				staleTime: 5 * 60 * 1000, // 5 minutes
				gcTime: 10 * 60 * 1000, // 10 minutes
			},
		);

	// Fetch project costs top 5 with 5-minute cache
	const { data: projectCosts, isLoading: isLoadingProjectCosts } =
		api.cost.getProjectCostsTopN.useQuery(
			{
				limit: 5,
				days: 7,
			},
			{
				staleTime: 5 * 60 * 1000, // 5 minutes
				gcTime: 10 * 60 * 1000, // 10 minutes
			},
		);

	// Format currency
	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("ko-KR", {
			style: "currency",
			currency: "USD",
		}).format(amount);
	};

	// Format change percentage
	const formatChange = (change: number) => {
		const sign = change > 0 ? "+" : "";
		return `${sign}${change.toFixed(1)}%`;
	};

	// Determine trend direction
	const getTrend = (change: number): "up" | "down" | "neutral" => {
		if (change > 0) return "up";
		if (change < 0) return "down";
		return "neutral";
	};

	return (
		<div className="space-y-6">
			<div>
				<h2 className="font-bold text-2xl text-foreground">
					Welcome to FinOps for AI
				</h2>
				<p className="mt-2 text-muted-foreground text-sm">
					Track and optimize your AI infrastructure costs
				</p>
			</div>

			{/* Cost Summary Cards */}
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<StatCard
					label="어제 총 비용"
					value={formatCurrency(costSummary?.yesterdayCost ?? 0)}
					icon={<DollarSign className="h-5 w-5" />}
					variant="primary"
					loading={isLoading}
				/>

				<StatCard
					label="이번 주 총 비용"
					value={formatCurrency(costSummary?.thisWeekCost ?? 0)}
					change={
						costSummary?.weeklyChange !== undefined &&
						costSummary?.weeklyChange !== 0
							? formatChange(costSummary.weeklyChange)
							: undefined
					}
					trend={
						costSummary?.weeklyChange !== undefined
							? getTrend(costSummary.weeklyChange)
							: "neutral"
					}
					icon={<TrendingUp className="h-5 w-5" />}
					variant="primary"
					loading={isLoading}
				/>

				<StatCard
					label="이번 달 총 비용"
					value={formatCurrency(costSummary?.thisMonthCost ?? 0)}
					change={
						costSummary?.monthlyChange !== undefined &&
						costSummary?.monthlyChange !== 0
							? formatChange(costSummary.monthlyChange)
							: undefined
					}
					trend={
						costSummary?.monthlyChange !== undefined
							? getTrend(costSummary.monthlyChange)
							: "neutral"
					}
					icon={<DollarSign className="h-5 w-5" />}
					variant="primary"
					loading={isLoading}
				/>
			</div>

			{/* Data Status Info */}
			{!isLoading && costSummary && (
				<div className="rounded-lg border border-info/30 bg-info/10 p-4">
					<div className="flex">
						<div className="flex-shrink-0">
							<svg
								className="h-5 w-5 text-info"
								viewBox="0 0 20 20"
								fill="currentColor"
							>
								<title>Info</title>
								<path
									fillRule="evenodd"
									d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
									clipRule="evenodd"
								/>
							</svg>
						</div>
						<div className="ml-3 flex-1">
							<p className="text-info-foreground text-sm">
								<strong>Note:</strong> OpenAI API usage data is delayed by 8-24
								hours. The cost shown here reflects usage from 1-2 days ago, not
								real-time usage.
							</p>
						</div>
					</div>
				</div>
			)}

			{/* Team Costs Top 5 Chart */}
			{!isLoadingTeamCosts && teamCosts && teamCosts.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Users className="h-5 w-5 text-primary" />
							팀별 비용 Top 5 (최근 7일)
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="h-[300px]">
							<ResponsiveContainer width="100%" height="100%">
								<BarChart
									data={teamCosts}
									onClick={(data: unknown) => {
										if (
											typeof data === "object" &&
											data !== null &&
											"activePayload" in data &&
											Array.isArray(data.activePayload) &&
											data.activePayload[0]?.payload?.teamId
										) {
											const teamId = data.activePayload[0].payload
												.teamId as string;
											router.push(`/teams/${teamId}`);
										}
									}}
								>
									<CartesianGrid
										strokeDasharray="3 3"
										className="stroke-muted"
									/>
									<XAxis
										dataKey="teamName"
										className="text-sm"
										tick={{ fill: "hsl(var(--muted-foreground))" }}
									/>
									<YAxis
										className="text-sm"
										tick={{ fill: "hsl(var(--muted-foreground))" }}
										tickFormatter={(value: number) => `$${value.toFixed(2)}`}
									/>
									<Tooltip
										contentStyle={{
											backgroundColor: "hsl(var(--card))",
											border: "1px solid hsl(var(--border))",
											borderRadius: "8px",
										}}
										labelStyle={{ color: "hsl(var(--foreground))" }}
										formatter={(value: number, name: string) => [
											formatCurrency(value),
											name === "totalCost" ? "총 비용" : name,
										]}
									/>
									<Bar
										dataKey="totalCost"
										fill="hsl(var(--primary))"
										radius={[8, 8, 0, 0]}
										cursor="pointer"
									>
										{teamCosts.map((entry, index) => {
											return (
												<Cell
													key={`cell-${entry.teamId}`}
													fill={`hsl(var(--primary) / ${1 - index * 0.15})`}
												/>
											);
										})}
									</Bar>
								</BarChart>
							</ResponsiveContainer>
						</div>
						<div className="mt-4 grid gap-2">
							{teamCosts.map((team, index) => {
								return (
									<button
										key={team.teamId}
										type="button"
										className="flex w-full cursor-pointer items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-accent"
										onClick={() => router.push(`/teams/${team.teamId}`)}
									>
										<div className="flex items-center gap-3">
											<div
												className="h-8 w-1 rounded-full"
												style={{
													backgroundColor: `hsl(var(--primary) / ${1 - index * 0.15})`,
												}}
											/>
											<span className="font-medium">{team.teamName}</span>
										</div>
										<div className="text-right">
											<div className="font-semibold">
												{formatCurrency(team.totalCost)}
											</div>
											{team.budget && (
												<div className="text-muted-foreground text-xs">
													예산: {formatCurrency(team.budget)}
												</div>
											)}
										</div>
									</button>
								);
							})}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Project Costs Top 5 Chart */}
			{!isLoadingProjectCosts && projectCosts && projectCosts.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<FolderOpen className="h-5 w-5 text-primary" />
							주요 프로젝트 비용 Top 5 (최근 7일)
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="h-[300px]">
							<ResponsiveContainer width="100%" height="100%">
								<BarChart
									data={projectCosts}
									onClick={(data: unknown) => {
										if (
											typeof data === "object" &&
											data !== null &&
											"activePayload" in data &&
											Array.isArray(data.activePayload) &&
											data.activePayload[0]?.payload?.projectId
										) {
											const projectId = data.activePayload[0].payload
												.projectId as string;
											router.push(`/projects/${projectId}`);
										}
									}}
								>
									<CartesianGrid
										strokeDasharray="3 3"
										className="stroke-muted"
									/>
									<XAxis
										dataKey="projectName"
										className="text-sm"
										tick={{ fill: "hsl(var(--muted-foreground))" }}
									/>
									<YAxis
										className="text-sm"
										tick={{ fill: "hsl(var(--muted-foreground))" }}
										tickFormatter={(value: number) => `$${value.toFixed(2)}`}
									/>
									<Tooltip
										contentStyle={{
											backgroundColor: "hsl(var(--card))",
											border: "1px solid hsl(var(--border))",
											borderRadius: "8px",
										}}
										labelStyle={{ color: "hsl(var(--foreground))" }}
										formatter={(value: number, name: string) => [
											formatCurrency(value),
											name === "totalCost" ? "총 비용" : name,
										]}
									/>
									<Bar
										dataKey="totalCost"
										fill="hsl(var(--chart-2))"
										radius={[8, 8, 0, 0]}
										cursor="pointer"
									>
										{projectCosts.map((entry, index) => {
											return (
												<Cell
													key={`cell-${entry.projectId}`}
													fill={`hsl(var(--chart-2) / ${1 - index * 0.15})`}
												/>
											);
										})}
									</Bar>
								</BarChart>
							</ResponsiveContainer>
						</div>
						<div className="mt-4 grid gap-2">
							{projectCosts.map((project, index) => {
								return (
									<button
										key={project.projectId}
										type="button"
										className="flex w-full cursor-pointer items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-accent"
										onClick={() =>
											router.push(`/projects/${project.projectId}`)
										}
									>
										<div className="flex items-center gap-3">
											<div
												className="h-8 w-1 rounded-full"
												style={{
													backgroundColor: `hsl(var(--chart-2) / ${1 - index * 0.15})`,
												}}
											/>
											<div>
												<div className="font-medium">{project.projectName}</div>
												<div className="text-muted-foreground text-xs">
													{project.teamName}
												</div>
											</div>
										</div>
										<div className="text-right">
											<div className="font-semibold">
												{formatCurrency(project.totalCost)}
											</div>
											{project.weeklyChange !== 0 && (
												<div
													className={`text-xs ${
														project.weeklyChange > 0
															? "text-destructive"
															: "text-success"
													}`}
												>
													{formatChange(project.weeklyChange)}
												</div>
											)}
										</div>
									</button>
								);
							})}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Empty State (when no data) */}
			{!isLoading &&
				costSummary?.yesterdayCost === 0 &&
				costSummary?.thisWeekCost === 0 && (
					<div className="rounded-lg border-2 border-border border-dashed p-12">
						<div className="text-center">
							<svg
								className="mx-auto h-12 w-12 text-muted-foreground"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								aria-hidden="true"
							>
								<title>No Data</title>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
								/>
							</svg>
							<h3 className="mt-2 font-semibold text-foreground text-sm">
								No cost data yet
							</h3>
							<p className="mt-1 text-muted-foreground text-sm">
								비용 데이터가 아직 없습니다. API 키를 설정하고 비용 수집을
								기다리세요.
							</p>
							<p className="mt-2 text-muted-foreground/70 text-xs">
								Data collection runs daily at 9am KST
							</p>
						</div>
					</div>
				)}
		</div>
	);
}
