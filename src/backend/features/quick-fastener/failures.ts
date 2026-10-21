/** Saying why a run's step failed, in our own words; Onshape's are for developers. */
import { HttpStatus } from "http-status-ts";
import { ApiError } from "../../lib/api-error";
import { onshapeStatus } from "../version-manager/failures";
import { FastenerTaskAction } from "./contract";

/**
 * Marks a message this module already worded. Workflows rebuilds an error that
 * leaves a step with its name prefixed to the message, so it is found anywhere.
 */
const WORDED_PREFIX = "Quick fastener stopped: ";

const UNEXPECTED =
    "Something went wrong. If it keeps happening, contact the FRCDesignApp developers.";

const ACTION_FAILURE = {
    [FastenerTaskAction.INDEX]: "Couldn't read the assembly's holes.",
    [FastenerTaskAction.INSERT]: "Couldn't insert the fasteners.",
    [FastenerTaskAction.FASTEN]: "Couldn't fasten the inserted parts."
} as const;

/** Whether Onshape refused before doing anything, so trying again can't duplicate parts. */
export function isRateLimited(error: unknown): boolean {
    return onshapeStatus(error) === HttpStatus.TOO_MANY_REQUESTS;
}

/** Why a step failed, as the message of the error it leaves its step with. */
export function describeStepFailure(
    error: unknown,
    action: FastenerTaskAction
): string {
    if (error instanceof ApiError) {
        return WORDED_PREFIX + error.body.message;
    }
    switch (onshapeStatus(error)) {
        case HttpStatus.UNAUTHORIZED:
            return (
                WORDED_PREFIX +
                "Your Onshape sign-in expired. Reopen the app from Onshape and try again."
            );
        case HttpStatus.FORBIDDEN:
            return (
                WORDED_PREFIX +
                "You don't have permission to edit this assembly."
            );
        case HttpStatus.TOO_MANY_REQUESTS:
            return (
                WORDED_PREFIX +
                "Onshape is limiting requests. Try again in a few minutes."
            );
    }
    return WORDED_PREFIX + ACTION_FAILURE[action];
}

/** Why a step, or the whole run, failed: our own wording, or one for the unexpected. */
export function describeRunFailure(error: unknown): string {
    if (!(error instanceof Error)) {
        return UNEXPECTED;
    }
    const worded = error.message.indexOf(WORDED_PREFIX);
    return worded === -1
        ? UNEXPECTED
        : error.message.slice(worded + WORDED_PREFIX.length);
}
