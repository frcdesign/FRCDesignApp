import { z } from "zod";
import { cacheMiddleware } from "../../lib/cache";
import { getApp } from "../../lib/context";
import { validate } from "../../lib/validate";
import { type Db, getDb } from "../../db/client";
import { groups } from "../../db/schema";
import { INSTANCE_TYPES } from "../../lib/onshape/path";
import { getAssemblyBom } from "../../lib/onshape/endpoints/assemblies";
import { requireSignInMiddleware } from "../auth/guards";
import { trackMassReport } from "../analytics/tracking";
import { toMassReport } from "./bom";
import { type MassReportOut } from "./contract";

export const massAnalysisRoutes = getApp();

const elementPathSchema = z.object({
    documentId: z.string().min(1),
    instanceType: z.enum(INSTANCE_TYPES),
    instanceId: z.string().min(1),
    elementId: z.string().min(1)
});

async function getLibraryDocumentIds(db: Db): Promise<Set<string>> {
    const rows = await db
        .selectDistinct({ documentId: groups.documentId })
        .from(groups)
        .all();
    return new Set(rows.map((row) => row.documentId));
}

/**
 * GET /api/mass-analysis?documentId=&instanceType=&instanceId=&elementId= —
 * the assembly's parts and subassemblies, with each part's mass, read from its
 * BOM as the caller.
 */
massAnalysisRoutes.get(
    "/mass-analysis",
    requireSignInMiddleware,
    cacheMiddleware(),
    validate("query", elementPathSchema),
    async (c) => {
        const assembly = c.req.valid("query");
        const [bom, libraryDocumentIds] = await Promise.all([
            getAssemblyBom(await c.var.getOnshapeApi(), assembly),
            getLibraryDocumentIds(getDb(c.env.DB))
        ]);
        const report = toMassReport(bom, libraryDocumentIds);
        await trackMassReport(c, assembly);
        return c.json(report satisfies MassReportOut);
    }
);
