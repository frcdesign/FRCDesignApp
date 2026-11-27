/** A run's failures, in our own words; Onshape's are for developers. */
import { ApiError, ApiErrorKind } from "../../lib/api-error";
import { describeOnshapeFailure } from "../../lib/onshape/failures";
import { runFailures } from "../../lib/run-failures";
import { AssemblyRunKind, AssemblyTaskAction } from "./contract";

const failures = runFailures("Auto Assembly stopped: ");

const ACTION_FAILURE = {
    [AssemblyTaskAction.INDEX]: "Couldn't read the assembly's holes.",
    [AssemblyTaskAction.REMOVE]: "Couldn't delete the screws to update.",
    [AssemblyTaskAction.INSERT]: "Couldn't insert the parts.",
    [AssemblyTaskAction.FASTEN]: "Couldn't fasten the inserted parts."
} as const;

function actionFailure(
    action: AssemblyTaskAction,
    kind: AssemblyRunKind
): string {
    return action === AssemblyTaskAction.INDEX &&
        kind === AssemblyRunKind.DECLARED_PARTS
        ? "Couldn't find the assembly's FeatureScript parts."
        : ACTION_FAILURE[action];
}

/** Why a step failed, as the message of the error it leaves its step with. */
export function describeStepFailure(
    error: unknown,
    action: AssemblyTaskAction,
    kind: AssemblyRunKind = AssemblyRunKind.FASTENERS
): string {
    // An internal error's message is for the logs, which the step writes
    if (
        error instanceof ApiError &&
        error.body.kind !== ApiErrorKind.INTERNAL
    ) {
        return failures.word(error.body.message);
    }
    if (error instanceof ApiError) {
        return failures.word(actionFailure(action, kind));
    }
    return failures.word(
        describeOnshapeFailure(error, {
            forbidden: "You don't have permission to edit this assembly."
        }) ?? actionFailure(action, kind)
    );
}

/** Why a step, or the whole run, failed. */
export const describeRunFailure = failures.describe;

/** A failure met outside any Onshape call, in the user's words. */
export function runFailure(message: string): Error {
    return new Error(failures.word(message));
}
