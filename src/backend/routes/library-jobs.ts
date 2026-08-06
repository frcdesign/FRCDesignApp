import { getApp, getLibraryParam, libraryRoute } from "../app";
import { getDb } from "../db";
import { requireEditorMiddleware } from "../access-level-utils";
import {
    listLibraryJobs,
    reconcileRunningLibraryJobs,
    toLibraryJob
} from "../library-jobs";
import { type LibraryJobsData } from "../../shared/library-job-models";

export const libraryJobRoutes = getApp();

/** GET /api/library-jobs/library/:libraryId */
libraryJobRoutes.get(
    "/library-jobs" + libraryRoute(),
    requireEditorMiddleware,
    async (c) => {
        const libraryId = getLibraryParam(c);
        const db = getDb(c.env.DB);

        const jobs = await listLibraryJobs(db, libraryId);
        const reconciled = await reconcileRunningLibraryJobs(c.env, jobs);
        const libraryJobs = reconciled.map(toLibraryJob);

        return c.json({ libraryJobs } satisfies LibraryJobsData);
    }
);
