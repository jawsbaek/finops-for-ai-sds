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
import { Separator } from "@/components/ui/separator";
import {
	AlertTriangle,
	Check,
	Copy,
	Key,
	Loader2,
	Plus,
	ShieldAlert,
	Users,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "~/trpc/react";

export default function TeamDetailPage() {
	const params = useParams();
	const router = useRouter();
	const teamId = params.teamId as string;

	const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
	const [disableDialogOpen, setDisableDialogOpen] = useState(false);
	const [apiKeyInput, setApiKeyInput] = useState("");
	const [disableReason, setDisableReason] = useState("");
	const [selectedApiKeyId, setSelectedApiKeyId] = useState<string | null>(null);

	// Fetch team data
	const { data: team, isLoading } = api.team.getById.useQuery({ teamId });

	// Get utils
	const utils = api.useUtils();

	// Generate API key mutation
	const generateApiKey = api.team.generateApiKey.useMutation({
		onSuccess: () => {
			toast.success("API 키가 생성되었습니다");
			setApiKeyDialogOpen(false);
			setApiKeyInput("");
			void utils.team.getById.invalidate({ teamId });
		},
		onError: (error) => {
			toast.error("API 키 생성 실패", {
				description: error.message,
			});
		},
	});

	// Disable API key mutation
	const disableApiKey = api.team.disableApiKey.useMutation({
		onSuccess: () => {
			toast.success("API 키가 비활성화되었습니다");
			setDisableDialogOpen(false);
			setDisableReason("");
			setSelectedApiKeyId(null);
			void utils.team.getById.invalidate({ teamId });
		},
		onError: (error) => {
			toast.error("API 키 비활성화 실패", {
				description: error.message,
			});
		},
	});

	const handleGenerateApiKey = () => {
		if (!apiKeyInput.trim()) {
			toast.error("API 키를 입력해주세요");
			return;
		}

		generateApiKey.mutate({
			teamId,
			provider: "openai",
			apiKey: apiKeyInput.trim(),
		});
	};

	const handleDisableApiKey = () => {
		if (!selectedApiKeyId) return;

		if (!disableReason.trim()) {
			toast.error("비활성화 사유를 입력해주세요");
			return;
		}

		disableApiKey.mutate({
			apiKeyId: selectedApiKeyId,
			reason: disableReason.trim(),
		});
	};

	const copyToClipboard = (text: string) => {
		navigator.clipboard
			.writeText(text)
			.then(() => {
				toast.success("클립보드에 복사되었습니다");
			})
			.catch(() => {
				toast.error("복사 실패");
			});
	};

	// Format currency
	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("ko-KR", {
			style: "currency",
			currency: "USD",
		}).format(amount);
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!team) {
		return (
			<div className="flex flex-col items-center justify-center py-12">
				<AlertTriangle className="mb-4 h-12 w-12 text-destructive" />
				<p className="text-center text-muted-foreground">
					팀을 찾을 수 없습니다
				</p>
				<Button className="mt-4" onClick={() => router.push("/teams")}>
					팀 목록으로 돌아가기
				</Button>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h2 className="font-bold text-2xl text-foreground">{team.name}</h2>
				<p className="mt-2 text-muted-foreground text-sm">
					팀 정보 및 API 키 관리
				</p>
			</div>

			{/* Team Info Card */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Users className="h-5 w-5" />팀 정보
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid gap-4 sm:grid-cols-2">
						<div>
							<Label className="text-muted-foreground text-sm">팀명</Label>
							<p className="mt-1 font-medium">{team.name}</p>
						</div>
						{team.budget && (
							<div>
								<Label className="text-muted-foreground text-sm">월 예산</Label>
								<p className="mt-1 font-medium">
									{formatCurrency(team.budget)}
								</p>
							</div>
						)}
						<div>
							<Label className="text-muted-foreground text-sm">멤버 수</Label>
							<p className="mt-1 font-medium">{team.members.length}명</p>
						</div>
						<div>
							<Label className="text-muted-foreground text-sm">API 키 수</Label>
							<p className="mt-1 font-medium">{team.apiKeys.length}개</p>
						</div>
					</div>

					<Separator className="my-4" />

					{/* Team Members */}
					<div>
						<h3 className="mb-3 font-semibold">팀 멤버</h3>
						<div className="space-y-2">
							{team.members.map((member) => (
								<div
									key={member.id}
									className="flex items-center justify-between rounded-lg border p-3"
								>
									<div>
										<p className="font-medium">
											{member.user.name || member.user.email}
										</p>
										<p className="text-muted-foreground text-sm">
											{member.user.email}
										</p>
									</div>
									<span className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary text-xs">
										{member.role === "owner"
											? "소유자"
											: member.role === "admin"
												? "관리자"
												: "멤버"}
									</span>
								</div>
							))}
						</div>
					</div>
				</CardContent>
			</Card>

			{/* API Keys Card */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle className="flex items-center gap-2">
							<Key className="h-5 w-5" />
							API 키 관리
						</CardTitle>
						<Dialog open={apiKeyDialogOpen} onOpenChange={setApiKeyDialogOpen}>
							<DialogTrigger asChild>
								<Button size="sm" disabled={team.apiKeys.length > 0}>
									<Plus className="mr-2 h-4 w-4" />
									API 키 추가
								</Button>
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>OpenAI API 키 추가</DialogTitle>
									<DialogDescription>
										팀의 OpenAI API 키를 입력하세요. 키는 암호화되어 안전하게
										저장됩니다.
									</DialogDescription>
								</DialogHeader>
								<div className="grid gap-4 py-4">
									<div className="grid gap-2">
										<Label htmlFor="apiKey">
											API 키 <span className="text-destructive">*</span>
										</Label>
										<Input
											id="apiKey"
											type="password"
											placeholder="sk-proj-..."
											value={apiKeyInput}
											onChange={(e) => setApiKeyInput(e.target.value)}
										/>
										<p className="text-muted-foreground text-xs">
											OpenAI API 키 형식: sk-proj-* 또는 sk-*
										</p>
									</div>
									<div className="rounded-lg border border-warning/50 bg-warning/10 p-3">
										<p className="flex items-start gap-2 text-sm text-warning">
											<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
											<span>
												팀당 하나의 API 키만 등록할 수 있습니다. 비용 데이터는
												이 API 키를 기준으로 자동 수집됩니다.
											</span>
										</p>
									</div>
								</div>
								<DialogFooter>
									<Button
										variant="outline"
										onClick={() => setApiKeyDialogOpen(false)}
										disabled={generateApiKey.isPending}
									>
										취소
									</Button>
									<Button
										onClick={handleGenerateApiKey}
										disabled={generateApiKey.isPending || !apiKeyInput.trim()}
									>
										{generateApiKey.isPending && (
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										)}
										추가
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					</div>
				</CardHeader>
				<CardContent>
					{team.apiKeys.length === 0 ? (
						<div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8">
							<Key className="mb-3 h-10 w-10 text-muted-foreground" />
							<p className="text-center text-muted-foreground">
								등록된 API 키가 없습니다
							</p>
							<p className="mt-1 text-center text-muted-foreground text-sm">
								OpenAI API 키를 추가하여 비용을 자동으로 수집하세요
							</p>
						</div>
					) : (
						<div className="space-y-3">
							{team.apiKeys.map((apiKey) => (
								<div
									key={apiKey.id}
									className="flex items-center justify-between rounded-lg border p-4"
								>
									<div className="flex-1">
										<div className="flex items-center gap-2">
											<span className="font-mono text-sm">
												{apiKey.maskedKey}
											</span>
											<Button
												size="sm"
												variant="ghost"
												onClick={() => copyToClipboard(apiKey.maskedKey)}
											>
												<Copy className="h-4 w-4" />
											</Button>
											{apiKey.isActive ? (
												<span className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-success text-xs">
													<Check className="h-3 w-3" />
													활성
												</span>
											) : (
												<span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-destructive text-xs">
													<ShieldAlert className="h-3 w-3" />
													비활성
												</span>
											)}
										</div>
										<p className="mt-1 text-muted-foreground text-xs">
											제공자: {apiKey.provider.toUpperCase()} • 생성일:{" "}
											{new Date(apiKey.createdAt).toLocaleDateString("ko-KR")}
										</p>
									</div>
									{apiKey.isActive && (
										<Button
											size="sm"
											variant="destructive"
											onClick={() => {
												setSelectedApiKeyId(apiKey.id);
												setDisableDialogOpen(true);
											}}
										>
											<ShieldAlert className="mr-2 h-4 w-4" />
											비활성화
										</Button>
									)}
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Disable API Key Dialog */}
			<Dialog open={disableDialogOpen} onOpenChange={setDisableDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-destructive">
							<ShieldAlert className="h-5 w-5" />
							API 키 비활성화
						</DialogTitle>
						<DialogDescription>
							API 키를 비활성화하면 더 이상 비용이 수집되지 않습니다. 이 작업은
							감사 로그에 기록됩니다.
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="reason">
								비활성화 사유 <span className="text-destructive">*</span>
							</Label>
							<Input
								id="reason"
								placeholder="예: API 키 유출 의심"
								value={disableReason}
								onChange={(e) => setDisableReason(e.target.value)}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								setDisableDialogOpen(false);
								setDisableReason("");
								setSelectedApiKeyId(null);
							}}
							disabled={disableApiKey.isPending}
						>
							취소
						</Button>
						<Button
							variant="destructive"
							onClick={handleDisableApiKey}
							disabled={disableApiKey.isPending || !disableReason.trim()}
						>
							{disableApiKey.isPending && (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							)}
							비활성화
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
