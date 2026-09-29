/** How a run went, in words: what the toast and the last-run callout both say. */
import {
    VersionJobKind,
    VersionJobState,
    type VersionJobResult,
    type VersionJobStatus
} from "@backend/features/version-manager/contract";
import { plural } from "./queries";

export enum JobOutcome {
    SUCCESS = "success",
    /** Finished, but Onshape refused some tabs. */
    PARTIAL = "partial",
    FAILED = "failed"
}

/** Undefined while there is nothing finished to report. */
export function jobOutcome(
    status: VersionJobStatus | undefined
): JobOutcome | undefined {
    switch (status?.state) {
        case VersionJobState.COMPLETE:
            return (status.result?.failedElements ?? 0) > 0
                ? JobOutcome.PARTIAL
                : JobOutcome.SUCCESS;
        case VersionJobState.FAILED:
            return JobOutcome.FAILED;
    }
    return undefined;
}

/** "push", "pull", or "run" when the status doesn't say which. */
export function jobKindLabel(kind: VersionJobKind | undefined): string {
    switch (kind) {
        case VersionJobKind.PUSH:
            return "push";
        case VersionJobKind.PULL:
            return "pull";
    }
    return "run";
}

/** What the run changed, as clauses that can end either sentence below. */
function doneClauses(result: VersionJobResult): string[] {
    const clauses: string[] = [];
    if (result.createdVersions > 0) {
        clauses.push(`created ${plural(result.createdVersions, "version")}`);
    }
    if (result.updatedElements > 0) {
        clauses.push(
            `updated ${plural(result.updatedElements, "tab")} in ${plural(
                result.updatedWorkspaces,
                "workspace"
            )}`
        );
    }
    return clauses;
}

function refusedSentence(result: VersionJobResult): string | undefined {
    return result.failedElements > 0
        ? `${plural(result.failedElements, "tab")} couldn't be updated.`
        : undefined;
}

function capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/** What a finished run did. */
export function describeJobResult(result: VersionJobResult): string {
    const done = doneClauses(result);
    const opening =
        done.length > 0
            ? capitalize(done.join(" and ")) + "."
            : result.failedElements > 0
              ? "Nothing was updated."
              : "Everything was already up to date.";
    return [opening, refusedSentence(result)].filter(Boolean).join(" ");
}

/**
 * Why a run stopped, and what it had already done — which stays done in
 * Onshape, and is what somebody needs to know before running it again.
 */
export function describeJobFailure(status: VersionJobStatus): string {
    const reason = status.error ?? "The run stopped unexpectedly.";
    if (!status.result) {
        return reason;
    }
    const done = doneClauses(status.result);
    return [
        reason,
        done.length > 0
            ? `Before it stopped, it ${done.join(" and ")}.`
            : undefined,
        refusedSentence(status.result)
    ]
        .filter(Boolean)
        .join(" ");
}

/** The report for a finished run, whichever way it went. */
export function describeJob(status: VersionJobStatus): string {
    if (status.state === VersionJobState.FAILED) {
        return describeJobFailure(status);
    }
    return status.result
        ? describeJobResult(status.result)
        : "Finished updating Onshape.";
}
