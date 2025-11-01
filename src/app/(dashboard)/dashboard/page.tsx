export default function DashboardPage() {
	return (
		<div className="space-y-6">
			<div>
				<h2 className="font-bold text-2xl text-gray-900">
					Welcome to FinOps for AI
				</h2>
				<p className="mt-2 text-gray-600 text-sm">
					Track and optimize your AI infrastructure costs
				</p>
			</div>

			{/* Placeholder for cost data */}
			<div className="rounded-lg border-2 border-gray-300 border-dashed p-12">
				<div className="text-center">
					<svg
						className="mx-auto h-12 w-12 text-gray-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						aria-hidden="true"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
						/>
					</svg>
					<h3 className="mt-2 font-semibold text-gray-900 text-sm">
						No cost data yet
					</h3>
					<p className="mt-1 text-gray-500 text-sm">
						비용 데이터가 아직 없습니다. API 키를 설정하고 비용 수집을
						시작하세요.
					</p>
					<div className="mt-6">
						<button
							type="button"
							className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 font-semibold text-sm text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
						>
							Add API Key
						</button>
					</div>
				</div>
			</div>

			{/* Quick stats placeholders */}
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
				<div className="rounded-lg bg-white px-4 py-5 shadow sm:p-6">
					<dt className="truncate font-medium text-gray-500 text-sm">
						Total Cost (MTD)
					</dt>
					<dd className="mt-1 font-semibold text-3xl text-gray-900 tracking-tight">
						$0.00
					</dd>
				</div>
				<div className="rounded-lg bg-white px-4 py-5 shadow sm:p-6">
					<dt className="truncate font-medium text-gray-500 text-sm">
						Active Projects
					</dt>
					<dd className="mt-1 font-semibold text-3xl text-gray-900 tracking-tight">
						0
					</dd>
				</div>
				<div className="rounded-lg bg-white px-4 py-5 shadow sm:p-6">
					<dt className="truncate font-medium text-gray-500 text-sm">
						API Keys
					</dt>
					<dd className="mt-1 font-semibold text-3xl text-gray-900 tracking-tight">
						0
					</dd>
				</div>
			</div>
		</div>
	);
}
