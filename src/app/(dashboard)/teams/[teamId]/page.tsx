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

	const [disableDialogOpen, setDisableDialogOpen] = useState(false);
	const [inviteMemberDialogOpen, setInviteMemberDialogOpen] = useState(false);
	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");

	// Fetch team data
	const { data: team, isLoading } = api.team.getById.useQuery({ teamId });

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
					</div>

					<Separator className="my-4" />

					{/* Team Members */}
					<div>
						<div className="mb-3 flex items-center justify-between">
							<h3 className="font-semibold">팀 멤버</h3>
							<Button
								size="sm"
								variant="outline"
								onClick={() => setInviteMemberDialogOpen(true)}
							>
								<Plus className="mr-2 h-4 w-4" />
								멤버 초대
							</Button>
						</div>
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
