/**
 * Cost Alert Email Template
 *
 * React Email template for cost threshold breach alerts
 */

import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Html,
	Preview,
	Section,
	Text,
} from "@react-email/components";

export interface CostAlertEmailProps {
	projectName: string;
	teamName: string;
	currentCost: number;
	threshold: number;
	exceedancePercent: number;
	dashboardUrl: string;
}

export default function CostAlertEmail({
	projectName = "프로젝트 예시",
	teamName = "팀 예시",
	currentCost = 100.5,
	threshold = 50.0,
	exceedancePercent = 101.0,
	dashboardUrl = "https://example.com/dashboard",
}: CostAlertEmailProps) {
	return (
		<Html>
			<Head />
			<Preview>
				{teamName} - {projectName} 프로젝트의 비용이 임계값을 초과했습니다
			</Preview>
			<Body style={main}>
				<Container style={container}>
					<Heading style={h1}>🚨 비용 임계값 초과 알림</Heading>

					<Text style={text}>
						<strong>{teamName}</strong>의 <strong>{projectName}</strong>{" "}
						프로젝트에서 설정된 비용 임계값을 초과했습니다.
					</Text>

					<Section style={detailsSection}>
						<table style={detailsTable}>
							<tbody>
								<tr>
									<td style={detailsLabel}>프로젝트명</td>
									<td style={detailsValue}>{projectName}</td>
								</tr>
								<tr>
									<td style={detailsLabel}>현재 비용</td>
									<td style={detailsValue}>${currentCost.toFixed(2)}</td>
								</tr>
								<tr>
									<td style={detailsLabel}>임계값</td>
									<td style={detailsValue}>${threshold.toFixed(2)}</td>
								</tr>
								<tr>
									<td style={detailsLabel}>초과율</td>
									<td style={{ ...detailsValue, color: "#dc2626" }}>
										{exceedancePercent.toFixed(1)}%
									</td>
								</tr>
							</tbody>
						</table>
					</Section>

					<Section style={buttonSection}>
						<Button style={button} href={dashboardUrl}>
							상세 보기
						</Button>
					</Section>

					<Text style={footer}>
						비용이 계속 증가할 경우 프로젝트 설정에서 임계값을 조정하거나 API
						사용을 검토해주세요.
					</Text>
				</Container>
			</Body>
		</Html>
	);
}

// Styles
const main = {
	backgroundColor: "#f6f9fc",
	fontFamily:
		'-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
	backgroundColor: "#ffffff",
	margin: "0 auto",
	padding: "20px 0 48px",
	marginBottom: "64px",
	maxWidth: "600px",
};

const h1 = {
	color: "#1a1a1a",
	fontSize: "24px",
	fontWeight: "bold",
	margin: "40px 0 20px",
	padding: "0 40px",
};

const text = {
	color: "#4a4a4a",
	fontSize: "16px",
	lineHeight: "24px",
	margin: "16px 0",
	padding: "0 40px",
};

const detailsSection = {
	padding: "0 40px",
	margin: "24px 0",
};

const detailsTable = {
	width: "100%",
	border: "1px solid #e5e7eb",
	borderRadius: "8px",
	overflow: "hidden",
};

const detailsLabel = {
	padding: "12px 16px",
	backgroundColor: "#f9fafb",
	fontWeight: "600",
	color: "#6b7280",
	fontSize: "14px",
	width: "40%",
	borderBottom: "1px solid #e5e7eb",
};

const detailsValue = {
	padding: "12px 16px",
	color: "#1a1a1a",
	fontSize: "14px",
	borderBottom: "1px solid #e5e7eb",
};

const buttonSection = {
	padding: "0 40px",
	margin: "32px 0",
};

const button = {
	backgroundColor: "#dc2626",
	borderRadius: "6px",
	color: "#fff",
	fontSize: "16px",
	fontWeight: "600",
	textDecoration: "none",
	textAlign: "center" as const,
	display: "block",
	padding: "12px 20px",
};

const footer = {
	color: "#6b7280",
	fontSize: "14px",
	lineHeight: "20px",
	margin: "24px 0",
	padding: "0 40px",
};
