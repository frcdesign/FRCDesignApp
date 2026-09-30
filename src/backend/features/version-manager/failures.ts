/**
 * Telling an Onshape failure worth retrying from one that will fail the same way
 * again, and saying either in our own words for the person who ran the push or
 * pull. Onshape's own messages are not shown: they are written for developers.
 */
import { HttpStatus } from "http-status-ts";

/** What `OnshapeApi` spells into every error it throws. */
const STATUS_PATTERN = /Onshape API error (\d{3})/;

/** What a request that got no answer at all says, timed out or cut off. */
const NO_ANSWER_PATTERN = /timeout|timed out|aborted|fetch failed|network/i;

/**
 * Marks a message this module already worded, which is all that survives of an
 * error once Workflows has rebuilt it outside the step.
 */
const WORDED_PREFIX = "Version run stopped: ";

const SIGN_IN_EXPIRED =
    "Your Onshape sign-in expired. Reopen the app from Onshape and try again.";

const UNEXPECTED =
    "Something went wrong. If it keeps happening, contact the FRCDesignApp developers.";

/**
 * The HTTP status behind a failure, or undefined when nothing answered. Read
 * off the message as well, since Workflows rebuilds an error that leaves a step
 * and only the message survives.
 */
export function onshapeStatus(error: unknown): number | undefined {
    if (!(error instanceof Error)) {
        return undefined;
    }
    if ("status" in error && typeof error.status === "number") {
        return error.status;
    }
    const match = STATUS_PATTERN.exec(error.message);
    return match ? Number.parseInt(match[1], 10) : undefined;
}

/**
 * Whether trying again could go differently: a rate limit, Onshape having a bad
 * moment, or a request that got no answer at all. A refusal fails the same way
 * every time.
 */
export function isTransient(error: unknown): boolean {
    const status = onshapeStatus(error);
    return (
        status === undefined ||
        status === HttpStatus.TOO_MANY_REQUESTS ||
        status === HttpStatus.REQUEST_TIMEOUT ||
        status >= HttpStatus.INTERNAL_SERVER_ERROR
    );
}

/** What the step that failed was doing to its document. */
export enum RunAction {
    VERSION = "version",
    REFERENCES = "references"
}

const ACTION_FAILURE = {
    [RunAction.VERSION]: "Couldn't create a version of this document.",
    [RunAction.REFERENCES]: "Couldn't update this document's references."
} as const;

/**
 * Why a step refused by Onshape stopped the run, as the message of the error it
 * leaves with. "This document" is the one the report names beside it.
 */
export function describeStepFailure(error: unknown, action: RunAction): string {
    switch (onshapeStatus(error)) {
        case HttpStatus.UNAUTHORIZED:
            return WORDED_PREFIX + SIGN_IN_EXPIRED;
        case HttpStatus.FORBIDDEN:
            return (
                WORDED_PREFIX +
                "You don't have permission to edit this document."
            );
        case HttpStatus.NOT_FOUND:
            return (
                WORDED_PREFIX +
                "This document was deleted or is no longer shared with you."
            );
    }
    return WORDED_PREFIX + ACTION_FAILURE[action];
}

/** Why a whole run stopped, for the report that says how far it got. */
export function describeRunFailure(error: unknown): string {
    if (!(error instanceof Error)) {
        return UNEXPECTED;
    }
    if (error.message.startsWith(WORDED_PREFIX)) {
        return error.message.slice(WORDED_PREFIX.length);
    }
    const status = onshapeStatus(error);
    if (status === undefined) {
        return NO_ANSWER_PATTERN.test(error.message)
            ? "Onshape stopped responding. Try again shortly."
            : UNEXPECTED;
    }
    if (status === HttpStatus.UNAUTHORIZED) {
        return SIGN_IN_EXPIRED;
    }
    if (status === HttpStatus.TOO_MANY_REQUESTS) {
        return "Onshape is limiting requests. Try again in a few minutes.";
    }
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        return "Onshape is having problems. Try again shortly.";
    }
    return UNEXPECTED;
}
