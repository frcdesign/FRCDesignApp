import {
    WorkflowEntrypoint,
    type WorkflowEvent,
    type WorkflowStep
} from "cloudflare:workers";
import type { AppBindings } from "../../lib/context";
import { getOnshapeApiFromSessionId } from "../auth/request-auth";
import {
    createVersion,
    getVersions
} from "../../lib/onshape/endpoints/versions";
import type { OnshapeVersionInfo } from "../../lib/onshape/types";
import { ONSHAPE_STEP_RETRIES } from "../load/steps";
import {
    EMPTY_JOB_RESULT,
    nextVersionName,
    type VersionJobResult,
    type WorkspacePath
} from "./contract";
import {
    updateOutdatedReferences,
    type ReferenceUpdateCounts
} from "./references";
import { forgetJob } from "./jobs";

/** One workspace a push updates, and whether the run versions it afterwards. */
export interface PushStep {
    workspace: WorkspacePath;
    /**
     * Set only by a recursive push, and only because the workspaces past this
     * one have no other way to pick the change up: a reference can point at a
     * version, so there has to be one.
     */
    createVersion: boolean;
}

interface JobParamsBase {
    /** Whose Onshape session the run borrows; see the load workflow. */
    sessionId: string;
    /** The workspace the run was started from, which its status is keyed by. */
    workspace: WorkspacePath;
}

export interface PushJobParams extends JobParamsBase {
    kind: "push";
    /**
     * Absent for a quick push, where each document is versioned as Onshape's
     * own dialog would name it: see {@link nextVersionName}. A name given here
     * is used for every version the run cuts.
     */
    name?: string;
    description: string;
    /** In the order they have to run; see `pushOrder`. */
    steps: PushStep[];
}

export interface PullJobParams extends JobParamsBase {
    kind: "pull";
    /**
     * The documents to pull from. Absent means every out-of-date reference,
     * which is what the old app called "update all references".
     */
    sourceDocumentIds?: string[];
}

export type VersionJobParams = PushJobParams | PullJobParams;

/**
 * Runs a push or a pull.
 *
 * In a workflow rather than on the request because both are a chain of Onshape
 * writes: a rate limit partway through a push would otherwise leave a version
 * cut and half the references moved, with nothing to resume from. Every Onshape
 * step takes {@link ONSHAPE_STEP_RETRIES}, which honors Onshape's `Retry-After`.
 *
 * What may be done was settled before the run started — the route checks
 * permissions across every workspace in `steps`, so a push cannot cut its first
 * version only to find it may not finish.
 */
export class VersionManagerWorkflow extends WorkflowEntrypoint<
    AppBindings,
    VersionJobParams
> {
    async run(
        event: WorkflowEvent<VersionJobParams>,
        step: WorkflowStep
    ): Promise<VersionJobResult> {
        const params = event.payload;
        try {
            return params.kind === "push"
                ? await this._push(params, step)
                : await this._pull(params, step);
        } finally {
            // The status is read off the instance itself; this only clears the
            // pointer that lets a reopened panel find it.
            await step.do("forget-job", () =>
                forgetJob(this.env, params.workspace, event.instanceId)
            );
        }
    }

    private async _pull(
        params: PullJobParams,
        step: WorkflowStep
    ): Promise<VersionJobResult> {
        const client = await getOnshapeApiFromSessionId(
            this.env.KV,
            params.sessionId
        );
        const counts = await step.do(
            "pull-references",
            { retries: ONSHAPE_STEP_RETRIES },
            (): Promise<ReferenceUpdateCounts> =>
                updateOutdatedReferences(client, params.workspace, {
                    onlyDocumentIds: params.sourceDocumentIds
                })
        );
        return {
            ...EMPTY_JOB_RESULT,
            ...counts,
            updatedWorkspaces: counts.updatedElements > 0 ? 1 : 0
        };
    }

    private async _push(
        params: PushJobParams,
        step: WorkflowStep
    ): Promise<VersionJobResult> {
        const client = await getOnshapeApiFromSessionId(
            this.env.KV,
            params.sessionId
        );
        const { workspace, name, description } = params;

        /**
         * Cuts the version, under the name given or the one Onshape's own
         * dialog would offer. Per document, so a recursive push numbers each
         * one from its own history rather than carrying the first one's number.
         */
        const cutVersion = async (
            target: WorkspacePath
        ): Promise<OnshapeVersionInfo> => {
            const versionName =
                name ??
                nextVersionName(
                    (await getVersions(client, target)).map(
                        (version) => version.name
                    )
                );
            return createVersion(client, target, versionName, description);
        };

        const rootVersion = await step.do(
            "create-version",
            { retries: ONSHAPE_STEP_RETRIES },
            (): Promise<OnshapeVersionInfo> => cutVersion(workspace)
        );

        // Every version this run has cut, which is what the workspaces further
        // down are moved onto. Keyed by document, which the route has already
        // made unambiguous by refusing a run that versions one twice.
        const pinnedVersions: Record<string, string> = {
            [workspace.documentId]: rootVersion.id
        };

        const result: VersionJobResult = {
            ...EMPTY_JOB_RESULT,
            createdVersions: 1
        };

        for (const [index, pushStep] of params.steps.entries()) {
            const counts = await step.do(
                `update-refs-${index}`,
                { retries: ONSHAPE_STEP_RETRIES },
                (): Promise<ReferenceUpdateCounts> =>
                    updateOutdatedReferences(client, pushStep.workspace, {
                        onlyDocumentIds: Object.keys(pinnedVersions),
                        pinnedVersions
                    })
            );
            result.updatedElements += counts.updatedElements;
            result.failedElements += counts.failedElements;
            if (counts.updatedElements > 0) {
                result.updatedWorkspaces++;
            }

            if (!pushStep.createVersion) continue;

            const version = await step.do(
                `create-version-${index}`,
                { retries: ONSHAPE_STEP_RETRIES },
                (): Promise<OnshapeVersionInfo> =>
                    cutVersion(pushStep.workspace)
            );
            pinnedVersions[pushStep.workspace.documentId] = version.id;
            result.createdVersions++;
        }

        return result;
    }
}
