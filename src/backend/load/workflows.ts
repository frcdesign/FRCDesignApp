import {
    WorkflowEntrypoint,
    type WorkflowEvent,
    type WorkflowStep
} from "cloudflare:workers";
import { eq } from "drizzle-orm";
import type { AppBindings } from "../app";
import { getDb } from "../db";
import type { LibraryId } from "../../shared/types";
import { bumpLibraryVersion, rebuildSearchDb } from "../library-data";
import {
    type GroupJob,
    type GroupResult,
    type LoadDeps,
    loadGroup,
    mapLimit
} from "./load-group";
import { group } from "../../shared/schema";

const GROUP_CONCURRENCY = 4;

export interface AddGroupParams {
    /**
     * The new groupId to add.
     */
    groupId: string;
    documentId: string;
    libraryId: LibraryId;
    sessionId: string;
    /**
     * An existing group to place the new group after.
     */
    selectedGroupId?: string;
}

export interface SyncLibraryParams {
    libraryId: LibraryId;
    sessionId: string;
    forceReload?: boolean;
}

export class SyncLibraryWorkflow extends WorkflowEntrypoint<
    AppBindings,
    SyncLibraryParams
> {
    async run(
        event: WorkflowEvent<SyncLibraryParams>,
        step: WorkflowStep
    ): Promise<GroupResult[]> {
        const params = event.payload;
        const { libraryId, sessionId } = params;
        const forceReload = params.forceReload ?? false;

        const deps: LoadDeps = { env: this.env, sessionId, libraryId };

        const jobs = await step.do("plan", () =>
            this.plan(libraryId, forceReload)
        );

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

    private async plan(
        libraryId: LibraryId,
        forceReload: boolean
    ): Promise<GroupJob[]> {
        const db = getDb(this.env.DB);

        const groups = await db
            .select({ groupId: group.id, documentId: group.documentId })
            .from(group)
            .where(eq(group.libraryId, libraryId));

        return groups.map((group) => ({
            ...group,
            forceReload
        }));
    }
}

export class AddGroupWorkflow extends WorkflowEntrypoint<
    AppBindings,
    AddGroupParams
> {
    async run(
        event: WorkflowEvent<AddGroupParams>,
        step: WorkflowStep
    ): Promise<GroupResult> {
        const params = event.payload;
        const { libraryId, sessionId, groupId, documentId } = params;
        const deps: LoadDeps = { env: this.env, sessionId, libraryId };

        const job: GroupJob = {
            groupId,
            documentId,
            forceReload: false
        };

        let result;
        try {
            result = await loadGroup(deps, step, job);
        } catch {
            result = { groupId, status: "failed" as const };
        }

        await step.do("finalize", async () => {
            const db = getDb(this.env.DB);
            await rebuildSearchDb(db, libraryId);
            await bumpLibraryVersion(db, libraryId);
        });

        return result;
    }
}
