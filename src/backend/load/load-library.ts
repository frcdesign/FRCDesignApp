import {
    WorkflowEntrypoint,
    type WorkflowEvent,
    type WorkflowStep
} from "cloudflare:workers";
import { eq } from "drizzle-orm";
import type { AppBindings } from "../app";
import { getDb } from "../db";
import type { LibraryId } from "../../shared/types";
import { groups, libraries } from "../../shared/schema";
import { bumpLibraryVersion, rebuildSearchDb } from "../library-data";
import {
    type GroupJob,
    type GroupResult,
    type LoadDeps,
    loadGroup,
    mapLimit
} from "./load-group";

const GROUP_CONCURRENCY = 4;

export type LibraryLoadParams = {
    libraryId: LibraryId;
    sessionId: string;
} & (
    | { trigger: "reload-all"; forceReload?: boolean }
    | {
          trigger: "add-group";
          /** Minted by the route, so the client can reference the group immediately. */
          groupId: string;
          documentId: string;
          /** Place the new group after this sibling; append when omitted. */
          selectedGroupId?: string;
      }
);

/**
 * Syncs a library against Onshape.
 */
export class LibraryLoadWorkflow extends WorkflowEntrypoint<
    AppBindings,
    LibraryLoadParams
> {
    async run(
        event: WorkflowEvent<LibraryLoadParams>,
        step: WorkflowStep
    ): Promise<GroupResult[]> {
        const params = event.payload;
        const { libraryId, sessionId } = params;
        const deps: LoadDeps = { env: this.env, sessionId, libraryId };

        const jobs = await step.do("plan", () => this.plan(params));

        const results = await mapLimit(
            jobs,
            GROUP_CONCURRENCY,
            async (job): Promise<GroupResult> => {
                try {
                    return await loadGroup(deps, step, job);
                } catch {
                    return { groupId: job.groupId, status: "failed" };
                }
            }
        );

        await step.do("finalize", async () => {
            const db = getDb(this.env.DB);
            await rebuildSearchDb(db, libraryId);
            await bumpLibraryVersion(db, libraryId);
        });

        return results;
    }

    private async plan(params: LibraryLoadParams): Promise<GroupJob[]> {
        const db = getDb(this.env.DB);

        if (params.trigger === "add-group") {
            // Bootstrap the library row so placement and finalize have a parent.
            await db
                .insert(libraries)
                .values({ id: params.libraryId })
                .onConflictDoNothing();
            return [
                {
                    groupId: params.groupId,
                    documentId: params.documentId,
                    placeAfterGroupId: params.selectedGroupId,
                    forceReload: false
                }
            ];
        }

        const rows = await db
            .select({ groupId: groups.id, documentId: groups.documentId })
            .from(groups)
            .where(eq(groups.libraryId, params.libraryId));
        return rows.map((row) => ({
            ...row,
            forceReload: params.forceReload ?? false
        }));
    }
}
