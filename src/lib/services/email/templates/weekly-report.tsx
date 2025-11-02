/**
 * Weekly Report Email Template
 *
 * React Email template for weekly cost efficiency reports
 * Uses inline CSS for maximum email client compatibility
 */

import {
	Body,
	Container,
	Head,
	Heading,
	Hr,
	Html,
	Preview,
	Section,
	Text,
} from "@react-email/components";
import {
	type WeeklyReportData,
	formatCurrency,
	formatPercentage,
	formatReportDate,
} from "../../../services/reporting/report-generator";

interface WeeklyReportEmailProps {
	reportData: WeeklyReportData;
}

export default function WeeklyReportEmail({
	reportData,
}: WeeklyReportEmailProps) {
	const { weekStart, weekEnd, totalCost, weekChange, top3, bottom3 } =
		reportData;

	// Generate preview text
	const previewText = `주간 AI 비용 리포트 (${formatReportDate(weekStart)} - ${formatReportDate(weekEnd)}) - 총 비용: ${formatCurrency(totalCost)}`;

	return (
		<Html>
			<Head />
			<Preview>{previewText}</Preview>
			<Body style={main}>
				<Container style={container}>
					{/* Header */}
					<Section style={header}>
						<Heading style={h1}>주간 AI 비용 리포트</Heading>
						<Text style={reportPeriod}>
							{formatReportDate(weekStart)} - {formatReportDate(weekEnd)}
						</Text>
					</Section>

					{/* Summary Card */}
					<Section style={summaryCard}>
						<Text style={summaryLabel}>이번 주 총 비용</Text>
						<Text style={summaryValue}>{formatCurrency(totalCost)}</Text>
						<Text
							style={{
								...weekChangeText,
								color: weekChange > 0 ? "#ef4444" : "#10b981",
							}}
						>
							{weekChange > 0 ? "↑" : "↓"}{" "}
							{formatPercentage(Math.abs(weekChange))}
							<span style={weekChangeLabel}> 전주 대비</span>
						</Text>
					</Section>

					{/* Top 3 Projects */}
					<Section style={section}>
						<Heading style={h2}>🏆 비용 효율 Top 3 프로젝트</Heading>
						<Text style={sectionDescription}>
							비용 대비 가장 높은 성과를 낸 프로젝트들입니다.
						</Text>

						{top3.length > 0 ? (
							top3.map((project, index) => (
								<Section key={project.projectId} style={projectCard}>
									<Text style={projectRank}>#{index + 1}</Text>
									<Text style={projectName}>{project.projectName}</Text>
									<Section style={projectStats}>
										<Section style={statItem}>
											<Text style={statLabel}>총 비용</Text>
											<Text style={statValue}>
												{formatCurrency(project.totalCost)}
											</Text>
										</Section>
										<Section style={statItem}>
											<Text style={statLabel}>비용 효율</Text>
											<Text style={statValue}>
												{project.efficiency !== null
													? project.efficiency.toFixed(2)
													: "N/A"}
											</Text>
										</Section>
										<Section style={statItem}>
											<Text style={statLabel}>전주 대비</Text>
											<Text
												style={{
													...statValue,
													color: project.weekChange > 0 ? "#ef4444" : "#10b981",
												}}
											>
												{formatPercentage(project.weekChange)}
											</Text>
										</Section>
									</Section>
									<Text style={projectTrend}>
										비용 추세:{" "}
										{project.costTrend === "increasing"
											? "증가 ↑"
											: project.costTrend === "decreasing"
												? "감소 ↓"
												: "안정 →"}
									</Text>
								</Section>
							))
						) : (
							<Text style={emptyState}>데이터가 없습니다.</Text>
						)}
					</Section>

					<Hr style={divider} />

					{/* Bottom 3 Projects */}
					<Section style={section}>
						<Heading style={h2}>⚠️ 개선 필요 프로젝트 Bottom 3</Heading>
						<Text style={sectionDescription}>
							비용 효율 개선이 필요한 프로젝트들입니다.
						</Text>

						{bottom3.length > 0 ? (
							bottom3.map((project, index) => (
								<Section
									key={project.projectId}
									style={{ ...projectCard, ...warningCard }}
								>
									<Text style={projectRank}>
										#{reportData.projects.length - (bottom3.length - index - 1)}
									</Text>
									<Text style={projectName}>{project.projectName}</Text>
									<Section style={projectStats}>
										<Section style={statItem}>
											<Text style={statLabel}>총 비용</Text>
											<Text style={statValue}>
												{formatCurrency(project.totalCost)}
											</Text>
										</Section>
										<Section style={statItem}>
											<Text style={statLabel}>비용 효율</Text>
											<Text style={statValue}>
												{project.efficiency !== null
													? project.efficiency.toFixed(2)
													: "N/A"}
											</Text>
										</Section>
										<Section style={statItem}>
											<Text style={statLabel}>전주 대비</Text>
											<Text
												style={{
													...statValue,
													color: project.weekChange > 0 ? "#ef4444" : "#10b981",
												}}
											>
												{formatPercentage(project.weekChange)}
											</Text>
										</Section>
									</Section>
									<Text style={projectTrend}>
										비용 추세:{" "}
										{project.costTrend === "increasing"
											? "증가 ↑"
											: project.costTrend === "decreasing"
												? "감소 ↓"
												: "안정 →"}
									</Text>
								</Section>
							))
						) : (
							<Text style={emptyState}>데이터가 없습니다.</Text>
						)}
					</Section>

					{/* Footer */}
					<Hr style={divider} />
					<Section style={footer}>
						<Text style={footerText}>FinOps for AI - AI 비용 관리 플랫폼</Text>
						<Text style={footerText}>
							더 자세한 정보는 대시보드에서 확인하세요.
						</Text>
					</Section>
				</Container>
			</Body>
		</Html>
	);
}

// Inline styles for email compatibility
const main = {
	backgroundColor: "#f6f9fc",
	fontFamily:
		'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
};

const container = {
	backgroundColor: "#ffffff",
	margin: "0 auto",
	padding: "20px 0",
	marginBottom: "64px",
	maxWidth: "600px",
};

const header = {
	padding: "32px 24px",
	backgroundColor: "#4f46e5",
	borderRadius: "8px 8px 0 0",
};

const h1 = {
	color: "#ffffff",
	fontSize: "28px",
	fontWeight: "bold",
	margin: "0 0 8px 0",
	lineHeight: "1.3",
};

const h2 = {
	color: "#1f2937",
	fontSize: "20px",
	fontWeight: "600",
	margin: "0 0 12px 0",
};

const reportPeriod = {
	color: "#e0e7ff",
	fontSize: "14px",
	margin: "0",
};

const summaryCard = {
	margin: "24px",
	padding: "24px",
	backgroundColor: "#f9fafb",
	borderRadius: "8px",
	border: "1px solid #e5e7eb",
	textAlign: "center" as const,
};

const summaryLabel = {
	fontSize: "14px",
	color: "#6b7280",
	margin: "0 0 8px 0",
};

const summaryValue = {
	fontSize: "36px",
	fontWeight: "bold",
	color: "#1f2937",
	margin: "0 0 8px 0",
};

const weekChangeText = {
	fontSize: "18px",
	fontWeight: "600",
	margin: "0",
};

const weekChangeLabel = {
	fontSize: "14px",
	color: "#6b7280",
	fontWeight: "normal",
};

const section = {
	margin: "24px",
};

const sectionDescription = {
	fontSize: "14px",
	color: "#6b7280",
	margin: "0 0 16px 0",
	lineHeight: "1.5",
};

const projectCard = {
	padding: "16px",
	backgroundColor: "#ffffff",
	border: "1px solid #e5e7eb",
	borderRadius: "8px",
	marginBottom: "12px",
};

const warningCard = {
	borderColor: "#fbbf24",
	backgroundColor: "#fffbeb",
};

const projectRank = {
	fontSize: "12px",
	color: "#6b7280",
	fontWeight: "600",
	margin: "0 0 4px 0",
};

const projectName = {
	fontSize: "18px",
	color: "#1f2937",
	fontWeight: "600",
	margin: "0 0 12px 0",
};

const projectStats = {
	display: "flex",
	justifyContent: "space-between",
	marginBottom: "12px",
};

const statItem = {
	flex: "1",
	textAlign: "center" as const,
};

const statLabel = {
	fontSize: "12px",
	color: "#6b7280",
	margin: "0 0 4px 0",
};

const statValue = {
	fontSize: "16px",
	fontWeight: "600",
	color: "#1f2937",
	margin: "0",
};

const projectTrend = {
	fontSize: "12px",
	color: "#6b7280",
	margin: "0",
};

const emptyState = {
	fontSize: "14px",
	color: "#9ca3af",
	textAlign: "center" as const,
	padding: "32px 0",
};

const divider = {
	borderColor: "#e5e7eb",
	margin: "24px 0",
};

const footer = {
	textAlign: "center" as const,
	padding: "24px",
};

const footerText = {
	fontSize: "12px",
	color: "#9ca3af",
	margin: "4px 0",
};
