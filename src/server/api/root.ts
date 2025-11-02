import { alertRouter } from "~/server/api/routers/alert";
import { authRouter } from "~/server/api/routers/auth";
import { costRouter } from "~/server/api/routers/cost";
import { projectRouter } from "~/server/api/routers/project";
import { reportRouter } from "~/server/api/routers/report";
import { teamRouter } from "~/server/api/routers/team";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
	alert: alertRouter,
	auth: authRouter,
	cost: costRouter,
	project: projectRouter,
	report: reportRouter,
	team: teamRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
