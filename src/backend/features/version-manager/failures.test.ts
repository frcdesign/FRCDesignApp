import { describe, expect, it } from "vitest";
import {
    OnshapeApiError,
    OnshapeRateLimitError
} from "../../lib/onshape/client";
import {
    describeRunFailure,
    describeStepFailure,
    isTransient,
    onshapeStatus
} from "./failures";
import { VersionTaskAction } from "./contract";

function apiError(status: number, body = ""): OnshapeApiError {
    return new OnshapeApiError(`Onshape API error ${status}: ${body}`, status);
}

describe("onshapeStatus", () => {
    it("reads the status an OnshapeApiError carries", () => {
        expect(onshapeStatus(apiError(403))).toBe(403);
    });

    it("reads it off the message of an error Workflows rebuilt", () => {
        expect(onshapeStatus(new Error("Onshape API error 404: {}"))).toBe(404);
        expect(
            onshapeStatus(
                new Error("Onshape API error 429 (retry after 5s): slow down")
            )
        ).toBe(429);
    });

    it("is undefined when nothing answered", () => {
        expect(onshapeStatus(new Error("fetch failed"))).toBeUndefined();
        expect(onshapeStatus("not an error")).toBeUndefined();
    });
});

describe("isTransient", () => {
    it("retries rate limits, server errors and no answer", () => {
        expect(isTransient(new OnshapeRateLimitError("", 5))).toBe(true);
        expect(isTransient(apiError(502))).toBe(true);
        expect(isTransient(apiError(408))).toBe(true);
        expect(isTransient(new Error("The operation timed out"))).toBe(true);
    });

    it("does not retry a refusal", () => {
        expect(isTransient(apiError(400))).toBe(false);
        expect(isTransient(apiError(403))).toBe(false);
        expect(isTransient(apiError(404))).toBe(false);
    });
});

describe("describeStepFailure", () => {
    // Only the message survives Workflows rebuilding the step's error.
    const reported = (error: unknown, action: VersionTaskAction) =>
        describeRunFailure(new Error(describeStepFailure(error, action)));

    it("says what went wrong with the document, in our words", () => {
        expect(reported(apiError(403), VersionTaskAction.REFERENCES)).toBe(
            "You don't have permission to edit this document."
        );
        expect(reported(apiError(404), VersionTaskAction.VERSION)).toMatch(
            /deleted or is no longer shared/
        );
        expect(reported(apiError(401), VersionTaskAction.VERSION)).toMatch(
            /sign-in expired/
        );
    });

    it("names the call that failed rather than passing Onshape's message on", () => {
        const refusal = apiError(400, JSON.stringify({ message: "Bad ref" }));
        expect(reported(refusal, VersionTaskAction.REFERENCES)).toBe(
            "Couldn't update this document's references."
        );
        expect(reported(refusal, VersionTaskAction.VERSION)).toBe(
            "Couldn't create a version of this document."
        );
    });
});

describe("describeRunFailure", () => {
    it("words what outlasted its retries without the raw error", () => {
        expect(describeRunFailure(apiError(429))).toMatch(/limiting requests/);
        expect(describeRunFailure(apiError(503))).toMatch(/having problems/);
        expect(describeRunFailure(new Error("fetch failed"))).toMatch(
            /stopped responding/
        );
        expect(
            describeRunFailure(new Error("undefined is not a function"))
        ).toMatch(/Something went wrong/);
        expect(describeRunFailure(apiError(400, "Bad ref"))).toMatch(
            /Something went wrong/
        );
    });
});
