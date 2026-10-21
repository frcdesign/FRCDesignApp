/**
 * Reading what went wrong with an Onshape call, and saying it in the user's
 * words: Onshape's own messages are written for developers.
 */
import { HttpStatus } from "http-status-ts";

/** What `OnshapeApi` spells into every error it throws. */
const STATUS_PATTERN = /Onshape API error (\d{3})/;

/** What a request that got no answer at all says, timed out or cut off. */
const NO_ANSWER_PATTERN = /timeout|timed out|aborted|fetch failed|network/i;

export const OnshapeFailure = {
    SIGN_IN_EXPIRED:
        "Your Onshape sign-in expired. Sign in again, then try again.",
    FORBIDDEN:
        "Onshape rejected the operation. Make sure you have access to this document and you're signed in to the correct Onshape enterprise.",
    RATE_LIMITED: "Onshape is limiting requests. Try again in a few minutes.",
    UNAVAILABLE: "Onshape is having problems. Try again shortly.",
    NO_ANSWER: "Onshape stopped responding. Try again shortly."
} as const;

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

function isNoAnswer(error: unknown): boolean {
    return error instanceof Error && NO_ANSWER_PATTERN.test(error.message);
}

/**
 * Whether trying again could go differently: a rate limit, Onshape having a bad
 * moment, or a request that got no answer at all. Anything else fails the same
 * way every time.
 */
export function isTransient(error: unknown): boolean {
    const status = onshapeStatus(error);
    if (status === undefined) {
        return isNoAnswer(error);
    }
    return (
        status === HttpStatus.TOO_MANY_REQUESTS ||
        status === HttpStatus.REQUEST_TIMEOUT ||
        status >= HttpStatus.INTERNAL_SERVER_ERROR
    );
}

/** Whether Onshape refused before doing anything, so trying a write again can't do it twice. */
export function isRateLimited(error: unknown): boolean {
    return onshapeStatus(error) === HttpStatus.TOO_MANY_REQUESTS;
}

/** What the caller was refused, in its own terms. */
export interface RefusalWording {
    /** @default OnshapeFailure.FORBIDDEN */
    forbidden?: string;
    /** Left to the caller's own wording when absent. */
    notFound?: string;
}

/** The user's words for a failure its status explains; undefined for one it doesn't. */
export function describeOnshapeFailure(
    error: unknown,
    refusal: RefusalWording = {}
): string | undefined {
    const status = onshapeStatus(error);
    if (status === undefined) {
        return isNoAnswer(error) ? OnshapeFailure.NO_ANSWER : undefined;
    }
    switch (status) {
        case HttpStatus.UNAUTHORIZED:
            return OnshapeFailure.SIGN_IN_EXPIRED;
        case HttpStatus.FORBIDDEN:
            return refusal.forbidden ?? OnshapeFailure.FORBIDDEN;
        case HttpStatus.NOT_FOUND:
            return refusal.notFound;
        case HttpStatus.TOO_MANY_REQUESTS:
            return OnshapeFailure.RATE_LIMITED;
    }
    return status >= HttpStatus.INTERNAL_SERVER_ERROR
        ? OnshapeFailure.UNAVAILABLE
        : undefined;
}
