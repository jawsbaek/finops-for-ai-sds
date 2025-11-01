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
		<div className="min-h-screen bg-gray-100">
			{/* Header */}
			<header className="bg-white shadow">
				<div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
					<h1 className="font-bold text-3xl text-gray-900 tracking-tight">
						FinOps for AI
					</h1>
					<div className="flex items-center gap-4">
						<span className="text-gray-700 text-sm">{session.user?.email}</span>
						<form
							action={async () => {
								"use server";
								await signOut({ redirectTo: "/login" });
							}}
						>
							<button
								type="submit"
								className="rounded-md bg-red-600 px-3 py-2 font-semibold text-sm text-white hover:bg-red-500"
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
					<aside className="w-64 rounded-lg bg-white p-6 shadow">
						<nav className="space-y-2">
							<a
								href="/dashboard"
								className="block rounded-md bg-gray-100 px-3 py-2 font-medium text-gray-900 text-sm"
							>
								Dashboard
							</a>
							<a
								href="/dashboard/cost-analysis"
								className="block rounded-md px-3 py-2 font-medium text-gray-600 text-sm hover:bg-gray-50"
							>
								Cost Analysis
							</a>
							<a
								href="/dashboard/api-keys"
								className="block rounded-md px-3 py-2 font-medium text-gray-600 text-sm hover:bg-gray-50"
							>
								API Keys
							</a>
							<a
								href="/dashboard/settings"
								className="block rounded-md px-3 py-2 font-medium text-gray-600 text-sm hover:bg-gray-50"
							>
								Settings
							</a>
						</nav>
					</aside>

					{/* Main Content */}
					<main className="flex-1 rounded-lg bg-white p-6 shadow">
						{children}
					</main>
				</div>
			</div>
		</div>
	);
}
