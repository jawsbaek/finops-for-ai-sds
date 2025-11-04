"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
	AlertCircle,
	Bell,
	BookOpen,
	Cloud,
	Settings2,
	Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AIProviderDisplay } from "~/app/_components/ai-provider/AIProviderDisplay";
import { AIProviderRegistration } from "~/app/_components/ai-provider/AIProviderRegistration";
import { api } from "~/trpc/react";

export default function ProjectSettingsPage() {
	const params = useParams();
	const router = useRouter();
	const projectId = params.id as string;

	// Form state
	const [thresholdType, setThresholdType] = useState<"daily" | "weekly">(
		"daily",
	);
	const [thresholdValue, setThresholdValue] = useState<string>("");

	// Fetch project data
	const { data: project, refetch: refetchProject } =
		api.project.getById.useQuery({
			id: projectId,
		});

	// Fetch team admin keys to check availability
	const { data: adminKeys, isLoading: isLoadingAdminKeys } =
		api.team.getAdminApiKeys.useQuery(
			{
				teamId: project?.teamId ?? "",
			},
			{
				enabled: !!project?.teamId,
			},
		);

	// Fetch existing alerts
	const { data: alerts, refetch: refetchAlerts } = api.alert.getAlerts.useQuery(
		{
			projectId,
		},
	);

	// Mutations
	const setThresholdMutation = api.alert.setThreshold.useMutation({
		onSuccess: () => {
			toast.success("임계값 설정 완료", {
				description: "비용 임계값이 성공적으로 설정되었습니다.",
			});
			setThresholdValue("");
			void refetchAlerts();
		},
		onError: (error) => {
			toast.error("설정 실패", {
				description: error.message,
			});
		},
	});

	const deleteAlertMutation = api.alert.deleteAlert.useMutation({
		onSuccess: () => {
			toast.success("알림 삭제 완료", {
				description: "비용 알림이 성공적으로 삭제되었습니다.",
			});
			void refetchAlerts();
		},
		onError: (error) => {
			toast.error("삭제 실패", {
				description: error.message,
			});
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		const value = Number.parseFloat(thresholdValue);
		if (Number.isNaN(value) || value <= 0) {
			toast.error("유효하지 않은 값", {
				description: "0보다 큰 숫자를 입력해주세요.",
			});
			return;
		}

		setThresholdMutation.mutate({
			projectId,
			type: thresholdType,
			value,
		});
	};

	const handleDelete = (alertId: string) => {
		if (confirm("정말로 이 알림을 삭제하시겠습니까?")) {
			deleteAlertMutation.mutate({ alertId });
		}
	};

	// Check if admin key is available for current provider
	const hasAdminKey =
		project?.aiProvider && project?.aiOrganizationId
			? adminKeys?.some(
					(key) =>
						key.provider === project.aiProvider &&
						key.organizationId === project.aiOrganizationId &&
						key.isActive,
				)
			: false;

	// Get display name for current provider org
	const providerDisplayName =
		project?.aiProvider && project?.aiOrganizationId
			? (adminKeys?.find(
					(key) =>
						key.provider === project.aiProvider &&
						key.organizationId === project.aiOrganizationId,
				)?.displayName ?? undefined)
			: undefined;

	const hasAnyAdminKeys = adminKeys && adminKeys.length > 0;
	const isProviderLinked =
		project?.aiProvider && project?.aiOrganizationId && project?.aiProjectId;

	return (
		<div className="space-y-8 p-6" data-testid="project-settings-page">
			{/* Header */}
			<div>
				<h2 className="font-bold text-3xl tracking-tight">프로젝트 설정</h2>
				<p className="mt-2 text-muted-foreground">
					AI 제공자 연결 및 비용 임계값 알림을 설정하고 관리합니다
				</p>
			</div>

			{/* Setup Progress Banner */}
			{!isLoadingAdminKeys && !hasAnyAdminKeys && (
				<Alert
					variant="default"
					className="border-destructive/50 bg-destructive/10"
				>
					<AlertCircle className="h-4 w-4 text-destructive" />
					<AlertDescription>
						<div className="flex items-center justify-between">
							<div>
								<p className="font-medium text-foreground text-sm">
									Setup Required: Team Admin API Key
								</p>
								<p className="text-muted-foreground text-xs">
									Before linking this project to an AI provider, your team needs
									to register an Admin API Key in Team Settings.
								</p>
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									router.push(`/teams/${project?.teamId}/settings`);
								}}
								className="border-destructive/50 hover:bg-destructive/20"
							>
								Go to Team Settings
							</Button>
						</div>
					</AlertDescription>
				</Alert>
			)}

			{!isLoadingAdminKeys && hasAnyAdminKeys && !isProviderLinked && (
				<Alert variant="default" className="border-primary bg-primary/10">
					<Settings2 className="h-4 w-4 text-primary" />
					<AlertDescription>
						<div>
							<p className="font-medium text-foreground text-sm">
								Next Step: Link AI Provider
							</p>
							<p className="text-muted-foreground text-xs">
								Your team has registered Admin API Keys. Now link this project
								to an AI Provider Project ID to start tracking costs.
							</p>
						</div>
					</AlertDescription>
				</Alert>
			)}

			<Separator />

			{/* AI Provider Settings */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Cloud className="h-5 w-5" />
						AI 제공자 연결
					</CardTitle>
					<CardDescription>
						프로젝트를 AI 제공자의 프로젝트 ID와 연결하여 비용 데이터를
						수집합니다.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{project?.aiProvider &&
					project?.aiOrganizationId &&
					project?.aiProjectId ? (
						<AIProviderDisplay
							projectId={projectId}
							provider={project.aiProvider}
							organizationId={project.aiOrganizationId}
							aiProjectId={project.aiProjectId}
							displayName={providerDisplayName}
							hasAdminKey={hasAdminKey ?? false}
							onUnlink={() => void refetchProject()}
						/>
					) : (
						<AIProviderRegistration
							projectId={projectId}
							teamId={project?.teamId ?? ""}
							onSuccess={() => void refetchProject()}
						/>
					)}
				</CardContent>
			</Card>

			{/* Setup Guide */}
			{!isLoadingAdminKeys && !isProviderLinked && hasAnyAdminKeys && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-base">
							<BookOpen className="h-5 w-5 text-primary" />
							Setup Guide: Register AI Project ID
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4 text-sm">
						<div className="space-y-2">
							<h4 className="font-semibold">Step 1: Find Your AI Project ID</h4>
							<p className="text-muted-foreground">
								Go to your AI provider's dashboard and locate your Project ID:
							</p>
							<ul className="ml-6 list-disc space-y-1 text-muted-foreground">
								<li>
									<strong>OpenAI:</strong>{" "}
									<Link
										href="https://platform.openai.com/settings/organization/projects"
										target="_blank"
										rel="noopener noreferrer"
										className="text-primary hover:underline"
									>
										Projects Settings
									</Link>{" "}
									→ Select project → Copy Project ID (starts with proj_...)
								</li>
								<li>
									<strong>Anthropic:</strong> Console → Projects → Project
									Settings
								</li>
								<li>
									<strong>AWS:</strong> Account ID or Resource ARN
								</li>
								<li>
									<strong>Azure:</strong> Subscription ID or Resource Group ID
								</li>
							</ul>
						</div>

						<div className="space-y-2">
							<h4 className="font-semibold">
								Step 2: Select Provider and Organization
							</h4>
							<p className="text-muted-foreground">
								Use the form above to select the AI provider and organization
								that your team has already registered Admin API Keys for.
							</p>
						</div>

						<div className="space-y-2">
							<h4 className="font-semibold">
								Step 3: Enter and Validate Project ID
							</h4>
							<p className="text-muted-foreground">
								Paste your AI Project ID. The system will automatically validate
								it in real-time using your team's Admin API Key. Once validated,
								click "Register Provider" to complete the setup.
							</p>
						</div>

						<Alert>
							<AlertCircle className="h-4 w-4" />
							<AlertDescription className="text-xs">
								<strong>Important:</strong> The Project ID must be accessible
								via your team's Admin API Key. If validation fails, verify that
								the Project ID exists in your provider account and that your
								Admin API Key has the correct permissions.
							</AlertDescription>
						</Alert>
					</CardContent>
				</Card>
			)}

			<Separator />

			{/* Alert Settings */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Bell className="h-5 w-5" />
						비용 임계값 알림 설정
					</CardTitle>
					<CardDescription>
						프로젝트의 일일 또는 주간 비용이 설정한 임계값을 초과하면 Slack 및
						이메일로 알림을 받습니다.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="threshold-type">임계값 유형</Label>
								<Select
									value={thresholdType}
									onValueChange={(value) =>
										setThresholdType(value as "daily" | "weekly")
									}
								>
									<SelectTrigger id="threshold-type">
										<SelectValue placeholder="유형 선택" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="daily">일일 비용</SelectItem>
										<SelectItem value="weekly">주간 비용</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-2">
								<Label htmlFor="threshold-value">임계값 (USD)</Label>
								<Input
									id="threshold-value"
									type="number"
									step="0.01"
									min="0"
									placeholder="예: 100.00"
									value={thresholdValue}
									onChange={(e) => setThresholdValue(e.target.value)}
									required
								/>
							</div>
						</div>

						<Button
							type="submit"
							disabled={setThresholdMutation.isPending}
							className="w-full md:w-auto"
						>
							{setThresholdMutation.isPending ? "설정 중..." : "임계값 설정"}
						</Button>
					</form>
				</CardContent>
			</Card>

			{/* Current Alerts */}
			<Card>
				<CardHeader>
					<CardTitle>활성 알림</CardTitle>
					<CardDescription>
						현재 설정된 비용 임계값 알림 목록입니다.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{!alerts || alerts.length === 0 ? (
						<p className="text-center text-muted-foreground text-sm">
							설정된 알림이 없습니다.
						</p>
					) : (
						<div className="space-y-3">
							{alerts.map((alert) => (
								<div
									key={alert.id}
									className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
								>
									<div className="space-y-1">
										<p className="font-medium text-foreground text-sm">
											{alert.type === "daily" ? "일일 비용" : "주간 비용"}
										</p>
										<p className="text-muted-foreground text-xs">
											임계값: ${alert.value.toFixed(2)}
										</p>
										{alert.lastAlertSentAt && (
											<p className="text-muted-foreground text-xs">
												마지막 알림:{" "}
												{new Date(alert.lastAlertSentAt).toLocaleString(
													"ko-KR",
												)}
											</p>
										)}
									</div>
									<Button
										variant="ghost"
										size="icon"
										onClick={() => handleDelete(alert.id)}
										disabled={deleteAlertMutation.isPending}
										className="text-destructive hover:text-destructive"
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Information */}
			<Card>
				<CardHeader>
					<CardTitle>알림 정보</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2 text-muted-foreground text-sm">
					<ul className="ml-4 list-disc space-y-1">
						<li>
							시스템은 5분마다 비용을 확인하여 임계값 초과 여부를 검사합니다.
						</li>
						<li>
							임계값 초과 시 1분 이내에 Slack 및 이메일 알림이 발송됩니다.
						</li>
						<li>
							중복 알림 방지를 위해 동일 프로젝트에 대해 1시간당 최대 1회 알림이
							발송됩니다.
						</li>
						<li>
							알림 메시지에는 프로젝트명, 현재 비용, 임계값, 초과율이
							포함됩니다.
						</li>
					</ul>
				</CardContent>
			</Card>

			{/* Architecture Context */}
			<Alert>
				<AlertCircle className="h-4 w-4" />
				<AlertDescription className="text-xs">
					<strong>Cost Attribution Model:</strong> This project's costs are
					tracked via your team's Admin API Key using the Costs API. All costs
					for the linked AI Project ID are automatically attributed to this
					project. For detailed cost data, ensure your AI provider's project
					configuration matches this project's scope.
				</AlertDescription>
			</Alert>
		</div>
	);
}
