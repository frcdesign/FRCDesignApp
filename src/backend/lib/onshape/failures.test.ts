import { describe, expect, it } from "vitest";
import { OnshapeApiError, OnshapeRateLimitError } from "./client";
import {
    describeOnshapeFailure,
    isTransient,
    OnshapeFailure,
    onshapeStatus
} from "./failures";

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

describe("describeOnshapeFailure", () => {
    it("words what a status explains the same way everywhere", () => {
        expect(describeOnshapeFailure(apiError(401))).toBe(
            OnshapeFailure.SIGN_IN_EXPIRED
        );
        expect(describeOnshapeFailure(apiError(429))).toBe(
            OnshapeFailure.RATE_LIMITED
        );
        expect(describeOnshapeFailure(apiError(503))).toBe(
            OnshapeFailure.UNAVAILABLE
        );
        expect(describeOnshapeFailure(new Error("fetch failed"))).toBe(
            OnshapeFailure.NO_ANSWER
        );
    });

    it("says what was refused in the caller's terms", () => {
        expect(describeOnshapeFailure(apiError(403))).toBe(
            OnshapeFailure.FORBIDDEN
        );
        expect(
            describeOnshapeFailure(apiError(403), { forbidden: "Not yours." })
        ).toBe("Not yours.");
        expect(
            describeOnshapeFailure(apiError(404), { notFound: "Gone." })
        ).toBe("Gone.");
    });

    it("leaves what the status doesn't explain to the caller", () => {
        expect(
            describeOnshapeFailure(apiError(400, "Bad ref"))
        ).toBeUndefined();
        expect(describeOnshapeFailure(apiError(404))).toBeUndefined();
        expect(
            describeOnshapeFailure(new TypeError("x is undefined"))
        ).toBeUndefined();
    });
});
