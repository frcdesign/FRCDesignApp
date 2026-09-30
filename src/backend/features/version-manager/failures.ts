/**
 * Telling an Onshape failure worth retrying from one that will fail the same way
 * again, and saying either in words for the person who ran the push or pull.
 */
import { HttpStatus } from "http-status-ts";

/** What `OnshapeApi` spells into every error it throws. */
const STATUS_PATTERN = /Onshape API error (\d{3})/;

/** What a request that got no answer at all says, timed out or cut off. */
const NO_ANSWER_PATTERN = /timeout|timed out|aborted|fetch failed|network/i;

/**
 * The HTTP status behind a failure — Onshape's, or our own for a sign-in that
 * has gone — or undefined when nothing answered. Read off the message as well,
 * since Workflows rebuilds an error that leaves a step and only the message
 * survives.
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

/**
 * Whether Onshape refused the whole document rather than one tab: permissions,
 * and the sign-in behind them, are per document, so no tab of it would fare
 * better.
 */
export function refusesDocument(error: unknown): boolean {
    const status = onshapeStatus(error);
    return (
        status === HttpStatus.UNAUTHORIZED || status === HttpStatus.FORBIDDEN
    );
}

/** Onshape's own sentence, out of the JSON body its errors carry. */
function onshapeMessage(error: unknown): string | undefined {
    if (!(error instanceof Error)) {
        return undefined;
    }
    const body = error.message.replace(STATUS_PATTERN, "").replace(/^: /, "");
    try {
        const parsed: unknown = JSON.parse(body);
        if (
            parsed &&
            typeof parsed === "object" &&
            "message" in parsed &&
            typeof parsed.message === "string" &&
            parsed.message !== ""
        ) {
            return parsed.message;
        }
    } catch {
        // Not JSON: Onshape answered with a page or nothing.
    }
    return undefined;
}

/** Why Onshape would not update one tab. */
export function describeTabFailure(error: unknown): string {
    if (onshapeStatus(error) === HttpStatus.NOT_FOUND) {
        return "The tab, or the version it references, no longer exists.";
    }
    return onshapeMessage(error) ?? "Onshape refused the update.";
}

/** Why a whole run stopped, for the report that says how far it got. */
export function describeRunFailure(error: unknown): string {
    const status = onshapeStatus(error);
    if (status === undefined) {
        return error instanceof Error && NO_ANSWER_PATTERN.test(error.message)
            ? "Onshape stopped responding. Try again shortly."
            : "Something went wrong. If it keeps happening, contact the FRCDesignApp developers.";
    }
    if (status === HttpStatus.UNAUTHORIZED) {
        return "Your Onshape sign-in expired. Reopen the app from Onshape and try again.";
    }
    if (status === HttpStatus.TOO_MANY_REQUESTS) {
        return "Onshape is limiting requests. Try again in a few minutes.";
    }
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        return "Onshape is having problems. Try again shortly.";
    }
    if (status === HttpStatus.FORBIDDEN) {
        return "You no longer have permission to edit one of the documents.";
    }
    if (status === HttpStatus.NOT_FOUND) {
        return "One of the documents was deleted or is no longer shared with you.";
    }
    return onshapeMessage(error) ?? "Onshape refused part of the run.";
}
