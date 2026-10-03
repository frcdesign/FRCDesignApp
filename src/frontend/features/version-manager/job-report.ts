/** How a run is going or went, in the few words the toast and the callout share. */
import {
    failedTaskCount,
    VersionJobKind,
    VersionJobOutcome,
    VersionTaskAction,
    type VersionJobStatus
} from "@backend/features/version-manager/contract";
import { plural } from "../../lib/plural";
import { Status } from "../../lib/status";
import { StatusColor } from "../../lib/style-constants";
import { documentLabel } from "./document-label";

export const OUTCOME_STATUS: Record<VersionJobOutcome, Status> = {
    [VersionJobOutcome.SUCCESS]: Status.SUCCESS,
    [VersionJobOutcome.PARTIAL]: Status.WARNING,
    [VersionJobOutcome.FAILED]: Status.ERROR
};

function jobKindName(status: VersionJobStatus): string {
    if (status.updateOnly) {
        return "Update";
    }
    return status.kind === VersionJobKind.PULL ? "Pull" : "Push";
}

const OUTCOME_VERB = {
    [VersionJobOutcome.SUCCESS]: "succeeded",
    [VersionJobOutcome.PARTIAL]: "partially failed",
    [VersionJobOutcome.FAILED]: "failed"
} as const;

/** "Push succeeded", "Pull failed" and the like. */
export function jobHeadline(
    status: VersionJobStatus,
    outcome: VersionJobOutcome
): string {
    return `${jobKindName(status)} ${OUTCOME_VERB[outcome]}`;
}

/** The one document it was aimed at by name, or how many there were. */
function targetsName(status: VersionJobStatus): string {
    const targets = status.targets ?? [];
    if (targets.length === 1) {
        return documentLabel(targets[0].documentName);
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

interface JobStat {
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
    const failed = failedTaskCount(status);
    if (failed > 0) {
        stats.push({
            label: `${plural(failed, "step")} failed`,
            color: StatusColor.ERROR
        });
    }
    return stats;
}
