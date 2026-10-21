/** A push or pull's failures, in our own words for the person who ran it. */
import { describeOnshapeFailure } from "../../lib/onshape/failures";
import { runFailures } from "../../lib/run-failures";
import { VersionTaskAction } from "./contract";

const failures = runFailures("Version run stopped: ");

const ACTION_FAILURE = {
    [VersionTaskAction.VERSION]: "Couldn't create a version of this document.",
    [VersionTaskAction.REFERENCES]:
        "Couldn't update this document's references."
} as const;

/**
 * Why Onshape refused a task, as the message of the error it leaves its step
 * with. "This document" is the one the report names beside it.
 */
export function describeStepFailure(
    error: unknown,
    action: VersionTaskAction
): string {
    return failures.word(
        describeOnshapeFailure(error, {
            forbidden: "You don't have permission to edit this document.",
            notFound:
                "This document was deleted or is no longer shared with you."
        }) ?? ACTION_FAILURE[action]
    );
}

/** Why a task, or the whole run, failed. */
export const describeRunFailure = failures.describe;
