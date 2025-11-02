/**
 * Weekly Report Cron Job Endpoint
 *
 * Generates and sends weekly cost efficiency reports
 * Triggered by Vercel Cron every Monday at 00:00 UTC (09:00 KST)
 *
 * AC #1: Automatically generates weekly report every Monday at 9 AM KST
 */

import { format } from "date-fns";
import { NextResponse } from "next/server";
import { logger } from "~/lib/logger";
import {
	getAllUserEmails,
	sendWeeklyReport,
} from "~/lib/services/email/resend";
import {
	generateWeeklyReport,
	saveWeeklyReport,
} from "~/lib/services/reporting/report-generator";
import { db } from "~/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/weekly-report
 *
 * Vercel Cron job handler for weekly report generation and distribution
 */
export async function GET(request: Request) {
	const startTime = Date.now();

	try {
		// Step 1: Verify CRON_SECRET
		const authHeader = request.headers.get("authorization");
		const cronSecret = process.env.CRON_SECRET;

		if (!cronSecret) {
			logger.error({
				message: "CRON_SECRET environment variable not set",
			});
			return NextResponse.json(
				{ success: false, error: "Server configuration error" },
				{ status: 500 },
			);
		}

		if (authHeader !== `Bearer ${cronSecret}`) {
			logger.warn({
				message: "Unauthorized cron job attempt",
				authHeader: authHeader ? "present" : "missing",
			});
			return NextResponse.json(
				{ success: false, error: "Unauthorized" },
				{ status: 401 },
			);
		}

		// Step 2: Idempotency check using cron_logs table
		const today = format(new Date(), "yyyy-MM-dd");
		const jobName = "weekly-report";

		const existingLog = await db.cronLog.findUnique({
			where: {
				jobName_date: {
					jobName,
					date: today,
				},
			},
		});

		if (existingLog) {
			logger.info({
				jobName,
				date: today,
				executedAt: existingLog.executedAt,
				message: "Weekly report already generated today, skipping",
			});
			return NextResponse.json({
				success: true,
				message: "Report already generated today",
				executedAt: existingLog.executedAt,
			});
		}

		// Step 3: Generate weekly report
		logger.info({
			jobName,
			date: today,
			message: "Starting weekly report generation",
		});

		const reportData = await generateWeeklyReport();

		logger.info({
			jobName,
			totalCost: reportData.totalCost,
			weekChange: reportData.weekChange,
			projectCount: reportData.projects.length,
			message: "Weekly report generated successfully",
		});

		// Step 4: Save report to database (archive)
		const reportId = await saveWeeklyReport(reportData);

		logger.info({
			jobName,
			reportId,
			message: "Weekly report saved to database",
		});

		// Step 5: Get all user emails and send report
		const userEmails = await getAllUserEmails(db);

		if (userEmails.length === 0) {
			logger.warn({
				jobName,
				message: "No users found to send report to",
			});
		} else {
			const emailResult = await sendWeeklyReport(userEmails, reportData);

			logger.info({
				jobName,
				recipients: userEmails.length,
				sent: emailResult.sent,
				failed: emailResult.failed,
				success: emailResult.success,
				message: "Weekly report email distribution completed",
			});

			if (!emailResult.success) {
				logger.error({
					jobName,
					failed: emailResult.failed,
					message: "Some emails failed to send",
				});
			}
		}

		// Step 6: Log successful execution to cron_logs
		await db.cronLog.create({
			data: {
				jobName,
				date: today,
			},
		});

		const duration = Date.now() - startTime;

		logger.info({
			jobName,
			date: today,
			duration,
			reportId,
			message: "Weekly report cron job completed successfully",
		});

		return NextResponse.json({
			success: true,
			reportId,
			duration,
			recipients: userEmails.length,
		});
	} catch (error) {
		const duration = Date.now() - startTime;

		logger.error({
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
			duration,
			message: "Weekly report cron job failed",
		});

		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
