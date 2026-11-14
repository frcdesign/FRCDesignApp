import { eq } from "drizzle-orm";
import { type Db } from "../../db/client";
import {
    featureScripts,
    featureScriptsDocument
} from "../featurescripts/schema";
import { type ReportedFeatureScript } from "./discord";

/** Links open on cad's own domain: a reporter's company domain means nothing to a reader. */
const ONSHAPE_ORIGIN = "https://cad.onshape.com";

export interface FoundFeatureScript extends ReportedFeatureScript {
    /** What analytics count reports by, as they count adds. */
    featureType: string;
}

/** The feature as the loaded version has it; undefined when it isn't there. */
export async function findReportedFeatureScript(
    db: Db,
    featureScriptId: string
): Promise<FoundFeatureScript | undefined> {
    const [row, document] = await Promise.all([
        db
            .select({
                name: featureScripts.name,
                elementId: featureScripts.elementId,
                featureType: featureScripts.featureType,
                releaseVersion: featureScripts.releaseVersion,
                sourceUrl: featureScripts.sourceUrl
            })
            .from(featureScripts)
            .where(eq(featureScripts.id, featureScriptId))
            .get(),
        db.select().from(featureScriptsDocument).get()
    ]);
    if (!row || !document) {
        return undefined;
    }
    return {
        name: row.name,
        featureType: row.featureType,
        releaseVersion: row.releaseVersion ?? undefined,
        url: `${ONSHAPE_ORIGIN}/documents/${document.documentId}/v/${document.versionId}/e/${row.elementId}`,
        sourceUrl: row.sourceUrl ?? undefined
    };
}
