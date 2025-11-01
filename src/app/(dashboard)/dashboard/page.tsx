"use client";

import { StatCard } from "@/components/custom";
import { Clock, DollarSign, TrendingUp } from "lucide-react";
import { api } from "~/trpc/react";

export default function DashboardPage() {
	// Fetch cost summary data
	const { data: costSummary, isLoading } = api.cost.getSummary.useQuery({});

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
				<h2 className="font-bold text-2xl text-gray-900">
					Welcome to FinOps for AI
				</h2>
				<p className="mt-2 text-gray-600 text-sm">
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
					label="데이터 업데이트 지연"
					value="8-24시간"
					icon={<Clock className="h-5 w-5" />}
					variant="warning"
				/>
			</div>

			{/* Data Status Info */}
			{!isLoading && costSummary && (
				<div className="rounded-lg bg-blue-50 p-4">
					<div className="flex">
						<div className="flex-shrink-0">
							<svg
								className="h-5 w-5 text-blue-400"
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
							<p className="text-blue-700 text-sm">
								<strong>Note:</strong> OpenAI API usage data is delayed by 8-24
								hours. The cost shown here reflects usage from 1-2 days ago, not
								real-time usage.
							</p>
						</div>
					</div>
				</div>
			)}

			{/* Empty State (when no data) */}
			{!isLoading &&
				costSummary?.yesterdayCost === 0 &&
				costSummary?.thisWeekCost === 0 && (
					<div className="rounded-lg border-2 border-gray-300 border-dashed p-12">
						<div className="text-center">
							<svg
								className="mx-auto h-12 w-12 text-gray-400"
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
							<h3 className="mt-2 font-semibold text-gray-900 text-sm">
								No cost data yet
							</h3>
							<p className="mt-1 text-gray-500 text-sm">
								비용 데이터가 아직 없습니다. API 키를 설정하고 비용 수집을
								기다리세요.
							</p>
							<p className="mt-2 text-gray-400 text-xs">
								Data collection runs daily at 9am KST
							</p>
						</div>
					</div>
				)}
		</div>
	);
}
