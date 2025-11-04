"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
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
	AlertTriangle,
	Folder,
	Key,
	Loader2,
	Plus,
	Settings,
	Users,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "~/trpc/react";

export default function TeamDetailPage() {
	const params = useParams();
	const router = useRouter();
	const teamId = params.teamId as string;

	const [inviteMemberDialogOpen, setInviteMemberDialogOpen] = useState(false);
	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");

	// Fetch team data
	const { data: team, isLoading } = api.team.getById.useQuery({ teamId });

	// Fetch admin keys status
	const { data: adminKeys } = api.team.getAdminApiKeys.useQuery({ teamId });

	// Get utils
	const utils = api.useUtils();

	// Add member mutation
	const addMember = api.team.addMember.useMutation({
		onSuccess: () => {
			toast.success("멤버가 초대되었습니다");
			setInviteMemberDialogOpen(false);
			setInviteEmail("");
			setInviteRole("member");
			void utils.team.getById.invalidate({ teamId });
		},
		onError: (error) => {
			toast.error("멤버 초대 실패", {
				description: error.message,
			});
		},
	});

	const handleInviteMember = () => {
		if (!inviteEmail.trim()) {
			toast.error("이메일을 입력해주세요");
			return;
		}

		addMember.mutate({
			teamId,
			email: inviteEmail.trim(),
			role: inviteRole,
		});
	};

	// Format currency
	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("ko-KR", {
			style: "currency",
			currency: "USD",
		}).format(amount);
	};

	const hasActiveAdminKeys = adminKeys?.some((k) => k.isActive) ?? false;
	const activeAdminKeysCount = adminKeys?.filter((k) => k.isActive).length ?? 0;

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
			{/* Header with Actions */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="font-bold text-3xl tracking-tight">{team.name}</h2>
					<p className="mt-2 text-muted-foreground">
						팀 정보, 멤버, 프로젝트 및 API 키 관리
					</p>
				</div>
				<Link href={`/teams/${teamId}/settings`}>
					<Button variant="outline" size="sm">
						<Settings className="mr-2 h-4 w-4" />
						Team Settings
					</Button>
				</Link>
			</div>

			{/* Quick Status Cards */}
			<div className="grid gap-4 md:grid-cols-3">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="font-medium text-sm">팀 멤버</CardTitle>
						<Users className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="font-bold text-2xl">{team.members.length}</div>
						<p className="text-muted-foreground text-xs">
							{team.members.filter((m) => m.role === "owner").length} 소유자,{" "}
							{team.members.filter((m) => m.role === "admin").length} 관리자
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="font-medium text-sm">프로젝트</CardTitle>
						<Folder className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="font-bold text-2xl">{team.projects.length}</div>
						<p className="text-muted-foreground text-xs">
							{
								team.projects.filter((p) => p.apiKeyCount && p.apiKeyCount > 0)
									.length
							}{" "}
							with API keys
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="font-medium text-sm">
							Admin API Keys
						</CardTitle>
						<Key className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="font-bold text-2xl">
							{hasActiveAdminKeys ? activeAdminKeysCount : 0}
						</div>
						<p className="text-muted-foreground text-xs">
							{hasActiveAdminKeys ? (
								<span className="text-primary">Active</span>
							) : (
								<span className="text-destructive">Setup required</span>
							)}
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Team Members Card */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle className="flex items-center gap-2">
							<Users className="h-5 w-5" />팀 멤버
						</CardTitle>
						<Button
							size="sm"
							variant="outline"
							onClick={() => setInviteMemberDialogOpen(true)}
						>
							<Plus className="mr-2 h-4 w-4" />
							멤버 초대
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					{team.budget && (
						<div className="mb-4">
							<Label className="text-muted-foreground text-sm">월 예산</Label>
							<p className="mt-1 font-medium">{formatCurrency(team.budget)}</p>
						</div>
					)}

					<Separator className="my-4" />

					<div className="space-y-2">
						{team.members.map((member) => (
							<div
								key={member.id}
								className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/50"
							>
								<div>
									<p className="font-medium">
										{member.user.name || member.user.email}
									</p>
									<p className="text-muted-foreground text-sm">
										{member.user.email}
									</p>
								</div>
								<Badge variant="secondary">
									{member.role === "owner"
										? "소유자"
										: member.role === "admin"
											? "관리자"
											: "멤버"}
								</Badge>
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			{/* Projects Card */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle className="flex items-center gap-2">
							<Folder className="h-5 w-5" />
							프로젝트
						</CardTitle>
						<Button
							size="sm"
							variant="outline"
							onClick={() => router.push("/projects")}
						>
							<Plus className="mr-2 h-4 w-4" />
							프로젝트 생성
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					{team.projects.length === 0 ? (
						<p className="text-center text-muted-foreground text-sm">
							아직 프로젝트가 없습니다. 프로젝트를 생성하여 비용 추적을
							시작하세요.
						</p>
					) : (
						<div className="space-y-2">
							{team.projects.map((project) => (
								<Link
									key={project.id}
									href={`/projects/${project.id}`}
									className="block"
								>
									<div className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/50">
										<div>
											<p className="font-medium">{project.name}</p>
											{project.description && (
												<p className="text-muted-foreground text-sm">
													{project.description}
												</p>
											)}
										</div>
										<div className="flex items-center gap-2 text-muted-foreground text-xs">
											<span>{project.memberCount} 멤버</span>
											<span>•</span>
											<span>{project.apiKeyCount ?? 0} API 키</span>
										</div>
									</div>
								</Link>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Admin Keys Status Card */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Key className="h-5 w-5" />
						Admin API Keys
					</CardTitle>
				</CardHeader>
				<CardContent>
					{hasActiveAdminKeys ? (
						<div className="space-y-2">
							<p className="text-sm">
								이 팀에는 {activeAdminKeysCount}개의 활성화된 Admin API Key가
								등록되어 있습니다.
							</p>
							<div className="space-y-1">
								{adminKeys
									?.filter((k) => k.isActive)
									.map((key) => (
										<div
											key={`${key.provider}-${key.organizationId}`}
											className="flex items-center justify-between rounded-lg border p-2"
										>
											<div>
												<p className="font-medium text-sm">
													{key.displayName ??
														`${key.provider} - ${key.organizationId}`}
												</p>
												<p className="text-muted-foreground text-xs">
													Last 4: •••• {key.last4}
												</p>
											</div>
											<Badge variant="secondary" className="text-xs">
												{key.provider.toUpperCase()}
											</Badge>
										</div>
									))}
							</div>
							<Link href={`/teams/${teamId}/settings`}>
								<Button variant="outline" size="sm" className="mt-2 w-full">
									키 관리하기
								</Button>
							</Link>
						</div>
					) : (
						<div className="space-y-3">
							<p className="text-muted-foreground text-sm">
								Admin API Key를 등록하여 팀의 모든 프로젝트에서 AI 제공자의 비용
								데이터를 추적하세요.
							</p>
							<Link href={`/teams/${teamId}/settings`}>
								<Button variant="default" size="sm" className="w-full">
									<Key className="mr-2 h-4 w-4" />
									Admin API Key 등록하기
								</Button>
							</Link>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Invite Member Dialog */}
			<Dialog
				open={inviteMemberDialogOpen}
				onOpenChange={setInviteMemberDialogOpen}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>팀 멤버 초대</DialogTitle>
						<DialogDescription>
							초대할 멤버의 이메일과 역할을 입력하세요. 멤버는 팀의 프로젝트에
							접근할 수 있습니다.
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="inviteEmail">
								이메일 <span className="text-destructive">*</span>
							</Label>
							<Input
								id="inviteEmail"
								type="email"
								placeholder="member@example.com"
								value={inviteEmail}
								onChange={(e) => setInviteEmail(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										handleInviteMember();
									}
								}}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="inviteRole">역할</Label>
							<Select
								value={inviteRole}
								onValueChange={(value: "member" | "admin") =>
									setInviteRole(value)
								}
							>
								<SelectTrigger>
									<SelectValue placeholder="역할 선택" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="member">멤버</SelectItem>
									<SelectItem value="admin">관리자</SelectItem>
								</SelectContent>
							</Select>
							<p className="text-muted-foreground text-xs">
								관리자는 팀 설정을 변경하고 멤버를 관리할 수 있습니다.
							</p>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								setInviteMemberDialogOpen(false);
								setInviteEmail("");
								setInviteRole("member");
							}}
							disabled={addMember.isPending}
						>
							취소
						</Button>
						<Button
							onClick={handleInviteMember}
							disabled={addMember.isPending || !inviteEmail.trim()}
						>
							{addMember.isPending && (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							)}
							초대
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
