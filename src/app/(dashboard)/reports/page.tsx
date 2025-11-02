"use client";

/**
 * Weekly Reports Archive Page
 *
 * AC #5: Displays archived weekly cost efficiency reports
 */

import { format } from "date-fns";
import { FileText, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import { api } from "~/trpc/react";

export default function ReportsPage() {
	const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

	// Fetch recent weekly reports (default 12 weeks)
	const { data: reports, isLoading } = api.report.getRecentReports.useQuery({
		limit: 12,
	});

	// Fetch selected report details
	const { data: selectedReport } = api.report.getReportById.useQuery(
		{ id: selectedReportId ?? "" },
		{ enabled: !!selectedReportId },
	);

	// Format currency
	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("ko-KR", {
			style: "currency",
			currency: "USD",
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		}).format(amount);
	};

	// Format percentage
	const formatPercentage = (value: number) => {
		const sign = value > 0 ? "+" : "";
		return `${sign}${value.toFixed(1)}%`;
	};

	// Format date
	const formatDate = (date: Date) => {
		return format(new Date(date), "yyyy년 MM월 dd일");
	};

	return (
		<div className="space-y-6">
			<div>
				<h2 className="font-bold text-2xl text-foreground">
					주간 리포트 아카이브
				</h2>
				<p className="mt-2 text-muted-foreground text-sm">
					과거 주간 비용 효율성 리포트를 확인하세요
				</p>
			</div>

			{/* Reports List */}
			{isLoading && (
				<div className="flex items-center justify-center py-12">
					<div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
				</div>
			)}

			{!isLoading && reports && reports.length === 0 && (
				<div className="rounded-lg border-2 border-border border-dashed p-12">
					<div className="text-center">
						<FileText className="mx-auto h-12 w-12 text-muted-foreground" />
						<h3 className="mt-2 font-semibold text-foreground text-sm">
							리포트가 없습니다
						</h3>
						<p className="mt-1 text-muted-foreground text-sm">
							주간 리포트가 아직 생성되지 않았습니다. 매주 월요일 오전 9시에
							자동으로 생성됩니다.
						</p>
					</div>
				</div>
			)}

			{!isLoading && reports && reports.length > 0 && (
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
					{reports.map((report) => {
						// Parse report data
						const data = report.data as {
							totalCost: number;
							weekChange: number;
							top3: Array<{ projectName: string }>;
							bottom3: Array<{ projectName: string }>;
						};

						return (
							<button
								type="button"
								key={report.id}
								onClick={() => setSelectedReportId(report.id)}
								className="rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-card/80"
							>
								<div className="flex items-start justify-between">
									<div>
										<p className="font-semibold text-foreground text-sm">
											{formatDate(report.weekStart)} -{" "}
											{formatDate(report.weekEnd)}
										</p>
										<p className="mt-1 text-muted-foreground text-xs">
											{format(new Date(report.generatedAt), "yyyy-MM-dd HH:mm")}
										</p>
									</div>
									<FileText className="h-5 w-5 text-muted-foreground" />
								</div>

								<div className="mt-4">
									<p className="text-muted-foreground text-xs">총 비용</p>
									<p className="mt-1 font-bold text-foreground text-lg">
										{formatCurrency(data.totalCost)}
									</p>
								</div>

								<div className="mt-2 flex items-center gap-2">
									{data.weekChange > 0 ? (
										<TrendingUp className="h-4 w-4 text-danger" />
									) : (
										<TrendingDown className="h-4 w-4 text-success" />
									)}
									<span
										className={`font-medium text-sm ${
											data.weekChange > 0 ? "text-danger" : "text-success"
										}`}
									>
										{formatPercentage(data.weekChange)} 전주 대비
									</span>
								</div>
							</button>
						);
					})}
				</div>
			)}

			{/* Selected Report Detail Modal */}
			{selectedReport && (
				<button
					type="button"
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
					onClick={() => setSelectedReportId(null)}
					onKeyDown={(e) => {
						if (e.key === "Escape") setSelectedReportId(null);
					}}
					aria-label="Close modal"
				>
					<div
						className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-lg"
						onClick={(e) => e.stopPropagation()}
						onKeyDown={(e) => e.stopPropagation()}
					>
						<div className="mb-4 flex items-start justify-between">
							<div>
								<h3 className="font-bold text-foreground text-xl">
									주간 리포트
								</h3>
								<p className="mt-1 text-muted-foreground text-sm">
									{formatDate(selectedReport.weekStart)} -{" "}
									{formatDate(selectedReport.weekEnd)}
								</p>
							</div>
							<button
								type="button"
								onClick={() => setSelectedReportId(null)}
								className="text-muted-foreground hover:text-foreground"
							>
								<svg
									className="h-6 w-6"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<title>Close</title>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M6 18L18 6M6 6l12 12"
									/>
								</svg>
							</button>
						</div>

						{(() => {
							const data = selectedReport.data as {
								totalCost: number;
								weekChange: number;
								projects: Array<{
									projectName: string;
									totalCost: number;
									efficiency: number | null;
									weekChange: number;
								}>;
								top3: Array<{
									projectName: string;
									totalCost: number;
									efficiency: number | null;
									weekChange: number;
								}>;
								bottom3: Array<{
									projectName: string;
									totalCost: number;
									efficiency: number | null;
									weekChange: number;
								}>;
							};

							return (
								<div className="space-y-6">
									{/* Summary */}
									<div className="rounded-lg bg-background/50 p-4">
										<p className="text-muted-foreground text-sm">총 비용</p>
										<p className="mt-1 font-bold text-2xl text-foreground">
											{formatCurrency(data.totalCost)}
										</p>
										<p
											className={`mt-1 font-medium text-sm ${
												data.weekChange > 0 ? "text-danger" : "text-success"
											}`}
										>
											{formatPercentage(data.weekChange)} 전주 대비
										</p>
									</div>

									{/* Top 3 */}
									<div>
										<h4 className="mb-3 font-semibold text-foreground">
											🏆 비용 효율 Top 3
										</h4>
										<div className="space-y-2">
											{data.top3.map((project, idx) => (
												<div
													key={`${project.projectName}-${idx}`}
													className="rounded-lg border border-border bg-background/30 p-3"
												>
													<p className="font-medium text-foreground text-sm">
														{project.projectName}
													</p>
													<div className="mt-2 flex items-center gap-4">
														<div>
															<p className="text-muted-foreground text-xs">
																비용
															</p>
															<p className="font-semibold text-foreground text-sm">
																{formatCurrency(project.totalCost)}
															</p>
														</div>
														<div>
															<p className="text-muted-foreground text-xs">
																효율
															</p>
															<p className="font-semibold text-foreground text-sm">
																{project.efficiency?.toFixed(2) ?? "N/A"}
															</p>
														</div>
														<div>
															<p className="text-muted-foreground text-xs">
																증감
															</p>
															<p
																className={`font-semibold text-sm ${
																	project.weekChange > 0
																		? "text-danger"
																		: "text-success"
																}`}
															>
																{formatPercentage(project.weekChange)}
															</p>
														</div>
													</div>
												</div>
											))}
										</div>
									</div>

									{/* Bottom 3 */}
									<div>
										<h4 className="mb-3 font-semibold text-foreground">
											⚠️ 개선 필요 Bottom 3
										</h4>
										<div className="space-y-2">
											{data.bottom3.map((project, idx) => (
												<div
													key={`${project.projectName}-${idx}`}
													className="rounded-lg border border-warning bg-warning/5 p-3"
												>
													<p className="font-medium text-foreground text-sm">
														{project.projectName}
													</p>
													<div className="mt-2 flex items-center gap-4">
														<div>
															<p className="text-muted-foreground text-xs">
																비용
															</p>
															<p className="font-semibold text-foreground text-sm">
																{formatCurrency(project.totalCost)}
															</p>
														</div>
														<div>
															<p className="text-muted-foreground text-xs">
																효율
															</p>
															<p className="font-semibold text-foreground text-sm">
																{project.efficiency?.toFixed(2) ?? "N/A"}
															</p>
														</div>
														<div>
															<p className="text-muted-foreground text-xs">
																증감
															</p>
															<p
																className={`font-semibold text-sm ${
																	project.weekChange > 0
																		? "text-danger"
																		: "text-success"
																}`}
															>
																{formatPercentage(project.weekChange)}
															</p>
														</div>
													</div>
												</div>
											))}
										</div>
									</div>
								</div>
							);
						})()}
					</div>
				</button>
			)}
		</div>
	);
}
