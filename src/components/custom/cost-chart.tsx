"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Legend,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

export interface CostDataPoint {
	timestamp: Date | string;
	value: number;
	label?: string;
	[key: string]: unknown;
}

export interface CostChartProps {
	data: CostDataPoint[];
	type?: "trend" | "comparison" | "distribution";
	timeRange?: "1d" | "7d" | "30d" | "custom";
	compareWith?: "previous" | "budget" | "average";
	highlight?: string[];
	onDataPointClick?: (data: CostDataPoint) => void;
	className?: string;
}

interface TooltipEntry {
	name: string;
	value: number;
	color: string;
}

interface CustomTooltipProps {
	active?: boolean;
	payload?: TooltipEntry[];
	label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
	if (!active || !payload?.length) return null;

	return (
		<Card className="p-3 shadow-lg">
			<p className="mb-1 font-medium text-sm">
				{format(new Date(label as string), "PPP", { locale: ko })}
			</p>
			{payload.map((entry) => (
				<p key={entry.name} className="text-sm" style={{ color: entry.color }}>
					{entry.name}: ${entry.value?.toLocaleString()}
				</p>
			))}
		</Card>
	);
};

export function CostChart({
	data,
	type = "trend",
	timeRange = "7d",
	compareWith,
	highlight = [],
	onDataPointClick,
	className,
}: CostChartProps) {
	const formattedData = data.map((point) => ({
		...point,
		timestamp:
			typeof point.timestamp === "string"
				? new Date(point.timestamp)
				: point.timestamp,
		name: format(
			typeof point.timestamp === "string"
				? new Date(point.timestamp)
				: point.timestamp,
			"MMM d",
			{ locale: ko },
		),
	}));

	const chartProps = {
		data: formattedData,
		margin: { top: 5, right: 20, left: 10, bottom: 5 },
	};

	const renderChart = () => {
		switch (type) {
			case "trend":
				return (
					<LineChart {...chartProps}>
						<CartesianGrid strokeDasharray="3 3" className="stroke-border" />
						<XAxis
							dataKey="name"
							className="text-xs"
							stroke="hsl(var(--muted-foreground))"
						/>
						<YAxis
							className="text-xs"
							stroke="hsl(var(--muted-foreground))"
							tickFormatter={(value: number) => `$${value.toLocaleString()}`}
						/>
						<Tooltip content={<CustomTooltip />} />
						<Legend />
						<Line
							type="monotone"
							dataKey="value"
							stroke="hsl(var(--primary))"
							strokeWidth={2}
							dot={{ fill: "hsl(var(--primary))", r: 4 }}
							activeDot={{ r: 6 }}
							name="비용"
						/>
						{compareWith && (
							<Line
								type="monotone"
								dataKey="compareValue"
								stroke="hsl(var(--muted-foreground))"
								strokeWidth={2}
								strokeDasharray="5 5"
								dot={false}
								name={
									compareWith === "previous"
										? "이전 기간"
										: compareWith === "budget"
											? "예산"
											: "평균"
								}
							/>
						)}
					</LineChart>
				);

			case "comparison":
				return (
					<BarChart {...chartProps}>
						<CartesianGrid strokeDasharray="3 3" className="stroke-border" />
						<XAxis
							dataKey="name"
							className="text-xs"
							stroke="hsl(var(--muted-foreground))"
						/>
						<YAxis
							className="text-xs"
							stroke="hsl(var(--muted-foreground))"
							tickFormatter={(value: number) => `$${value.toLocaleString()}`}
						/>
						<Tooltip content={<CustomTooltip />} />
						<Legend />
						<Bar
							dataKey="value"
							fill="hsl(var(--primary))"
							radius={[4, 4, 0, 0]}
							name="비용"
						/>
					</BarChart>
				);

			case "distribution":
				return (
					<AreaChart {...chartProps}>
						<defs>
							<linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
								<stop
									offset="5%"
									stopColor="hsl(var(--primary))"
									stopOpacity={0.3}
								/>
								<stop
									offset="95%"
									stopColor="hsl(var(--primary))"
									stopOpacity={0}
								/>
							</linearGradient>
						</defs>
						<CartesianGrid strokeDasharray="3 3" className="stroke-border" />
						<XAxis
							dataKey="name"
							className="text-xs"
							stroke="hsl(var(--muted-foreground))"
						/>
						<YAxis
							className="text-xs"
							stroke="hsl(var(--muted-foreground))"
							tickFormatter={(value: number) => `$${value.toLocaleString()}`}
						/>
						<Tooltip content={<CustomTooltip />} />
						<Legend />
						<Area
							type="monotone"
							dataKey="value"
							stroke="hsl(var(--primary))"
							fillOpacity={1}
							fill="url(#colorValue)"
							name="비용"
						/>
					</AreaChart>
				);

			default:
				return null;
		}
	};

	return (
		<Card className={cn("p-6", className)}>
			<ResponsiveContainer width="100%" height={350}>
				{renderChart()}
			</ResponsiveContainer>
		</Card>
	);
}
