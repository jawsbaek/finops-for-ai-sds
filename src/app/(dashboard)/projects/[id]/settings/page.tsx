"use client";

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
import { useToast } from "@/hooks/use-toast";
import { Bell, Trash2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { api } from "~/trpc/react";

export default function ProjectSettingsPage() {
	const params = useParams();
	const projectId = params.id as string;
	const { toast } = useToast();

	// Form state
	const [thresholdType, setThresholdType] = useState<"daily" | "weekly">(
		"daily",
	);
	const [thresholdValue, setThresholdValue] = useState<string>("");

	// Fetch existing alerts
	const { data: alerts, refetch: refetchAlerts } = api.alert.getAlerts.useQuery(
		{
			projectId,
		},
	);

	// Mutations
	const setThresholdMutation = api.alert.setThreshold.useMutation({
		onSuccess: () => {
			toast({
				title: "임계값 설정 완료",
				description: "비용 임계값이 성공적으로 설정되었습니다.",
			});
			setThresholdValue("");
			void refetchAlerts();
		},
		onError: (error) => {
			toast({
				title: "설정 실패",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const deleteAlertMutation = api.alert.deleteAlert.useMutation({
		onSuccess: () => {
			toast({
				title: "알림 삭제 완료",
				description: "비용 알림이 성공적으로 삭제되었습니다.",
			});
			void refetchAlerts();
		},
		onError: (error) => {
			toast({
				title: "삭제 실패",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		const value = Number.parseFloat(thresholdValue);
		if (Number.isNaN(value) || value <= 0) {
			toast({
				title: "유효하지 않은 값",
				description: "0보다 큰 숫자를 입력해주세요.",
				variant: "destructive",
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

	return (
		<div className="space-y-6">
			<div>
				<h2 className="font-bold text-2xl text-foreground">프로젝트 설정</h2>
				<p className="mt-2 text-muted-foreground text-sm">
					비용 임계값 알림을 설정하고 관리합니다
				</p>
			</div>

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
		</div>
	);
}
