/** How a run is going or went, in the few words the toast and the callout share. */
import {
    VersionJobKind,
    VersionJobState,
    VersionTaskAction,
    VersionTaskState,
    type VersionJobResult,
    type VersionJobStatus,
    type VersionTask
} from "@backend/features/version-manager/contract";
import { Status } from "../../lib/status";
import { StatusColor } from "../../lib/style-constants";
import { plural } from "./queries";

export enum JobOutcome {
    SUCCESS = "success",
    /** Some of it failed, after changing something in Onshape. */
    PARTIAL = "partial",
    FAILED = "failed"
}

export const OUTCOME_STATUS: Record<JobOutcome, Status> = {
    [JobOutcome.SUCCESS]: Status.SUCCESS,
    [JobOutcome.PARTIAL]: Status.WARNING,
    [JobOutcome.FAILED]: Status.ERROR
};

/** What stays in Onshape whatever else the run did. */
function hasChanged(result: VersionJobResult | undefined): boolean {
    return (
        result !== undefined &&
        (result.createdVersions > 0 || result.updatedElements > 0)
    );
}

export function failedTasks(status: VersionJobStatus): VersionTask[] {
    return (status.tasks ?? []).filter(
        (task) => task.state === VersionTaskState.FAILED
    );
}

/** Undefined while there is nothing finished to report. */
export function jobOutcome(
    status: VersionJobStatus | undefined
): JobOutcome | undefined {
    if (
        status?.state !== VersionJobState.COMPLETE &&
        status?.state !== VersionJobState.FAILED
    ) {
        return undefined;
    }
    const failed =
        status.state === VersionJobState.FAILED ||
        failedTasks(status).length > 0;
    if (!failed) {
        return JobOutcome.SUCCESS;
    }
    return hasChanged(status.result) ? JobOutcome.PARTIAL : JobOutcome.FAILED;
}

function jobKindName(status: VersionJobStatus): string {
    if (status.updateOnly) {
        return "Update";
    }
    switch (status.kind) {
        case VersionJobKind.PUSH:
            return "Push";
        case VersionJobKind.PULL:
            return "Pull";
    }
    return "Run";
}

const OUTCOME_VERB = {
    [JobOutcome.SUCCESS]: "succeeded",
    [JobOutcome.PARTIAL]: "partially succeeded",
    [JobOutcome.FAILED]: "failed"
} as const;

/** "Push succeeded", "Pull failed" and the like. */
export function jobHeadline(
    status: VersionJobStatus,
    outcome: JobOutcome
): string {
    return `${jobKindName(status)} ${OUTCOME_VERB[outcome]}`;
}

/** The one document it was aimed at by name, or how many there were. */
function targetsName(status: VersionJobStatus): string {
    const targets = status.targets ?? [];
    if (targets.length === 1) {
        return targets[0].documentName ?? "a linked document";
    }
    return plural(targets.length, "document");
}

/** "Pushing to Practice Bot", "Pulling from 2 documents" and the like. */
export function runningHeadline(status: VersionJobStatus): string {
    const targets = targetsName(status);
    if (status.kind === VersionJobKind.PULL) {
        if ((status.targets ?? []).length === 0) {
            return "Updating references";
        }
        return status.updateOnly
            ? `Updating references to ${targets}`
            : `Pulling from ${targets}`;
    }
    return status.updateOnly
        ? `Updating references in ${targets}`
        : `Pushing to ${targets}`;
}

export const TASK_LABEL = {
    [VersionTaskAction.VERSION]: "Create version",
    [VersionTaskAction.REFERENCES]: "Update references"
} as const;

export interface JobStat {
    label: string;
    color: StatusColor;
}

/** One per thing the run did, omitting what it did none of. */
export function jobStats(status: VersionJobStatus): JobStat[] {
    const stats: JobStat[] = [];
    const { result } = status;
    if (result && result.createdVersions > 0) {
        stats.push({
            label: `${plural(result.createdVersions, "version")} created`,
            color: StatusColor.INFO
        });
    }
    if (result && result.updatedElements > 0) {
        stats.push({
            label: `${plural(result.updatedElements, "tab")} updated`,
            color: StatusColor.SUCCESS
        });
    }
    const failed = failedTasks(status).length;
    if (failed > 0) {
        stats.push({
            label: `${plural(failed, "step")} failed`,
            color: StatusColor.ERROR
        });
    }
    return stats;
}
