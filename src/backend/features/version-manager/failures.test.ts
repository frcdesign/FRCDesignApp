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

    it("does not retry a refusal, or a bug", () => {
        expect(isTransient(new TypeError("x is undefined"))).toBe(false);
        expect(isTransient(apiError(400))).toBe(false);
        expect(isTransient(apiError(403))).toBe(false);
        expect(isTransient(apiError(404))).toBe(false);
    });
});

describe("describeStepFailure", () => {
    // Only the message survives Workflows rebuilding the step's error.
    const reported = (error: unknown, action: VersionTaskAction) =>
        describeRunFailure(new Error(describeStepFailure(error, action)));
    const refusal = apiError(400, JSON.stringify({ message: "Bad ref" }));

    it("never passes Onshape's own message on", () => {
        expect(reported(refusal, VersionTaskAction.REFERENCES)).not.toContain(
            "Bad ref"
        );
    });

    it("tells the refusals apart, and the calls that were refused", () => {
        const messages = [
            reported(apiError(401), VersionTaskAction.VERSION),
            reported(apiError(403), VersionTaskAction.VERSION),
            reported(apiError(404), VersionTaskAction.VERSION),
            reported(refusal, VersionTaskAction.VERSION),
            reported(refusal, VersionTaskAction.REFERENCES)
        ];
        expect(new Set(messages).size).toBe(messages.length);
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
        expect(describeRunFailure(apiError(400, "Bad ref"))).not.toContain(
            "Bad ref"
        );
    });
});
