import { describe, expect, it } from "vitest";
import {
    OnshapeApiError,
    OnshapeRateLimitError
} from "../../lib/onshape/client";
import {
    describeRunFailure,
    describeTabFailure,
    isTransient,
    onshapeStatus,
    refusesDocument
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

    it("does not retry a refusal", () => {
        expect(isTransient(apiError(400))).toBe(false);
        expect(isTransient(apiError(403))).toBe(false);
        expect(isTransient(apiError(404))).toBe(false);
    });
});

describe("refusesDocument", () => {
    it("is a refusal of the whole document, not one tab", () => {
        expect(refusesDocument(apiError(401))).toBe(true);
        expect(refusesDocument(apiError(403))).toBe(true);
        expect(refusesDocument(apiError(404))).toBe(false);
    });
});

describe("describeTabFailure", () => {
    it("words the refusals it knows", () => {
        expect(describeTabFailure(apiError(404))).toMatch(/no longer exists/);
    });

    it("passes on Onshape's own message otherwise", () => {
        expect(
            describeTabFailure(
                apiError(400, JSON.stringify({ message: "Bad reference" }))
            )
        ).toBe("Bad reference");
        expect(describeTabFailure(apiError(400, "<html>"))).toBe(
            "Onshape refused the update."
        );
    });
});

describe("describeRunFailure", () => {
    it("says why the run stopped without the raw error", () => {
        expect(describeRunFailure(apiError(401))).toMatch(/sign-in expired/);
        expect(describeRunFailure(apiError(429))).toMatch(/limiting requests/);
        expect(describeRunFailure(apiError(503))).toMatch(/having problems/);
        expect(describeRunFailure(new Error("fetch failed"))).toMatch(
            /stopped responding/
        );
        expect(
            describeRunFailure(new Error("undefined is not a function"))
        ).toMatch(/Something went wrong/);
    });
});
