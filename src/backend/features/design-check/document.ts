/** A whole workspace's check: every Part Studio and Assembly, each reused until its tab changes. */
import { createLimiter } from "../../lib/limiter";
import { kvStore } from "../../lib/kv-store";
import { runInBackground } from "../../lib/background";
import { type AppContext } from "../../lib/context";
import { type OnshapeApi } from "../../lib/onshape/client";
import { ElementType } from "../../lib/onshape/element-type";
import { getContents } from "../../lib/onshape/endpoints/documents";
import { type InstancePath } from "../../lib/onshape/path";
import {
    type OnshapeElement,
    OnshapeElementType
} from "../../lib/onshape/types";
import { trackDesignCheck } from "../analytics/tracking";
import { elementsInTabOrder } from "../load/parse-document-contents";
import { checkDesign, type DesignCheckResult } from "./checks";
import { type TabCheck } from "./contract";
import { isOnshapeFailure, isRefusal, readSnapshot } from "./snapshot";

/** Two tabs' calls at once stay within a Worker's six open connections. */
const TAB_CONCURRENCY = 2;

const WEEK_SECONDS = 7 * 24 * 60 * 60;

/**
 * Part of every cached result's key. A change to what the checks find must
 * bump it, or tabs that haven't changed keep the old checks' results.
 */
const CHECKS_VERSION = 8;

/** A tab's result at one microversion, the same for everyone who can read it. */
const tabChecks = kvStore<DesignCheckResult>("design-check-tab", {
    ttlSeconds: WEEK_SECONDS
});

const CHECKED_TYPES: Partial<Record<OnshapeElementType, ElementType>> = {
    [OnshapeElementType.PART_STUDIO]: ElementType.PART_STUDIO,
    [OnshapeElementType.ASSEMBLY]: ElementType.ASSEMBLY
};

/**
 * Reads the workspace's tabs as the caller first, so a cached result goes only
 * to someone Onshape lets read the document; a refusal fails the whole check.
 */
export async function checkDocument(
    c: AppContext,
    client: OnshapeApi,
    workspace: InstancePath
): Promise<TabCheck[]> {
    const contents = await getContents(client, workspace);
    const limit = createLimiter(TAB_CONCURRENCY);
    return Promise.all(
        elementsInTabOrder(contents).flatMap((element) => {
            const elementType = CHECKED_TYPES[element.elementType];
            return elementType
                ? [
                      limit(() =>
                          checkTab(c, client, workspace, element, elementType)
                      )
                  ]
                : [];
        })
    );
}

async function checkTab(
    c: AppContext,
    client: OnshapeApi,
    workspace: InstancePath,
    element: OnshapeElement,
    elementType: ElementType
): Promise<TabCheck> {
    const tab = { elementId: element.id, name: element.name, elementType };
    const cacheId = [
        CHECKS_VERSION,
        workspace.documentId,
        element.id,
        element.microversionId
    ].join(":");
    const cached = await tabChecks.get(c.env.KV, cacheId);
    if (cached) {
        return { ...tab, ...cached, failed: false };
    }
    try {
        const result = checkDesign(
            await readSnapshot(
                client,
                { ...workspace, elementId: element.id },
                elementType
            )
        );
        await runInBackground(c, "cache a tab's design check", () =>
            tabChecks.put(c.env.KV, cacheId, result)
        );
        await trackDesignCheck(c, { elementType, issues: result.issues });
        return { ...tab, ...result, failed: false };
    } catch (error) {
        if (isRefusal(error) || !isOnshapeFailure(error)) {
            throw error;
        }
        console.warn("Failed to check a tab", error);
        return { ...tab, issues: [], sketchStatusUnknown: false, failed: true };
    }
}
