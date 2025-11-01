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
				<div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
					<h1 className="text-3xl font-bold tracking-tight text-gray-900">
						FinOps for AI
					</h1>
					<div className="flex items-center gap-4">
						<span className="text-sm text-gray-700">
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
								className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500"
							>
								Logout
							</button>
						</form>
					</div>
				</div>
			</header>

			{/* Sidebar and Main Content */}
			<div className="mx-auto max-w-7xl sm:px-6 lg:px-8 py-6">
				<div className="flex gap-6">
					{/* Sidebar */}
					<aside className="w-64 bg-white rounded-lg shadow p-6">
						<nav className="space-y-2">
							<a
								href="/dashboard"
								className="block px-3 py-2 rounded-md text-sm font-medium text-gray-900 bg-gray-100"
							>
								Dashboard
							</a>
							<a
								href="#"
								className="block px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50"
							>
								Cost Analysis
							</a>
							<a
								href="#"
								className="block px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50"
							>
								API Keys
							</a>
							<a
								href="#"
								className="block px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50"
							>
								Settings
							</a>
						</nav>
					</aside>

					{/* Main Content */}
					<main className="flex-1 bg-white rounded-lg shadow p-6">
						{children}
					</main>
				</div>
			</div>
		</div>
	);
}
