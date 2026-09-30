/** How a run went, in the few words the toast and the page's last-run section share. */
import {
    VersionJobKind,
    VersionJobState,
    type VersionJobResult,
    type VersionJobStatus
} from "@backend/features/version-manager/contract";
import {
    CheckCircleIcon,
    WarningIcon,
    XCircleIcon,
    type Icon
} from "@phosphor-icons/react";
import { StatusColor } from "../../lib/style-constants";
import { plural } from "./queries";

export enum JobOutcome {
    SUCCESS = "success",
    /** Stopped partway, after changing something in Onshape. */
    PARTIAL = "partial",
    FAILED = "failed"
}

export const OUTCOME_STYLE: Record<
    JobOutcome,
    { color: StatusColor; icon: Icon }
> = {
    [JobOutcome.SUCCESS]: { color: StatusColor.SUCCESS, icon: CheckCircleIcon },
    [JobOutcome.PARTIAL]: { color: StatusColor.WARNING, icon: WarningIcon },
    [JobOutcome.FAILED]: { color: StatusColor.ERROR, icon: XCircleIcon }
};

/** What stays in Onshape whether or not the run went on to finish. */
function hasChanged(result: VersionJobResult): boolean {
    return result.createdVersions > 0 || result.updatedElements > 0;
}

/** Undefined while there is nothing finished to report. */
export function jobOutcome(
    status: VersionJobStatus | undefined
): JobOutcome | undefined {
    switch (status?.state) {
        case VersionJobState.COMPLETE:
            return JobOutcome.SUCCESS;
        case VersionJobState.FAILED:
            return status.result && hasChanged(status.result)
                ? JobOutcome.PARTIAL
                : JobOutcome.FAILED;
    }
    return undefined;
}

function jobKindName(kind: VersionJobKind | undefined): string {
    switch (kind) {
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
    return `${jobKindName(status.kind)} ${OUTCOME_VERB[outcome]}`;
}

export interface JobStat {
    label: string;
    color: StatusColor;
}

/** One per thing the run did, omitting what it did none of. */
export function jobStats(result: VersionJobResult): JobStat[] {
    const stats: JobStat[] = [];
    if (result.createdVersions > 0) {
        stats.push({
            label: `${plural(result.createdVersions, "version")} created`,
            color: StatusColor.INFO
        });
    }
    if (result.reusedVersions > 0) {
        stats.push({
            label: `${plural(result.reusedVersions, "version")} reused`,
            color: StatusColor.NEUTRAL
        });
    }
    if (result.updatedElements > 0) {
        stats.push({
            label: `${plural(result.updatedElements, "tab")} updated`,
            color: StatusColor.SUCCESS
        });
    }
    return stats;
}
