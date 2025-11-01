import { redirect } from "next/navigation";
import { auth, signOut } from "~/server/auth";

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const session = await auth();

	if (!session) {
		redirect("/login");
	}

	return (
		<div className="min-h-screen bg-background">
			{/* Header */}
			<header className="border-border border-b bg-card shadow-sm">
				<div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
					<h1 className="font-bold text-3xl text-foreground tracking-tight">
						FinOps for AI
					</h1>
					<div className="flex items-center gap-4">
						<span className="text-foreground text-sm">
							{session.user?.email}
						</span>
						<form
							action={async () => {
								"use server";
								await signOut({ redirectTo: "/login" });
							}}
						>
							<button
								type="submit"
								className="rounded-md bg-error px-3 py-2 font-semibold text-error-foreground text-sm hover:bg-error/90"
							>
								Logout
							</button>
						</form>
					</div>
				</div>
			</header>

			{/* Sidebar and Main Content */}
			<div className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
				<div className="flex gap-6">
					{/* Sidebar */}
					<aside className="w-64 rounded-lg border border-border bg-card p-6 shadow-sm">
						<nav className="space-y-2">
							<a
								href="/dashboard"
								className="block rounded-md bg-primary/10 px-3 py-2 font-medium text-primary text-sm"
							>
								Dashboard
							</a>
							<a
								href="/dashboard/cost-analysis"
								className="block rounded-md px-3 py-2 font-medium text-muted-foreground text-sm hover:bg-muted hover:text-foreground"
							>
								Cost Analysis
							</a>
							<a
								href="/dashboard/api-keys"
								className="block rounded-md px-3 py-2 font-medium text-muted-foreground text-sm hover:bg-muted hover:text-foreground"
							>
								API Keys
							</a>
							<a
								href="/dashboard/settings"
								className="block rounded-md px-3 py-2 font-medium text-muted-foreground text-sm hover:bg-muted hover:text-foreground"
							>
								Settings
							</a>
						</nav>
					</aside>

					{/* Main Content */}
					<main className="flex-1 rounded-lg border border-border bg-card p-6 shadow-sm">
						{children}
					</main>
				</div>
			</div>
		</div>
	);
}
