import { describe, expect, it } from "vitest";
import { OnshapeApiError, OnshapeRateLimitError } from "./client";
import {
    describeOnshapeFailure,
    describeWait,
    isTransient,
    OnshapeFailure,
    onshapeStatus,
    readRetryAfterSeconds
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

    it("says how long a rate limit lasts, from the wait Onshape gave", () => {
        expect(
            describeOnshapeFailure(
                new OnshapeRateLimitError("slow down", 86367)
            )
        ).toBe("Onshape is limiting requests. Try again in about 24 hours.");
        // As Workflows rebuilds it, with the step's name in front
        expect(
            describeOnshapeFailure(
                new Error(
                    `index: ${new OnshapeRateLimitError("slow down", 300).message}`
                )
            )
        ).toBe("Onshape is limiting requests. Try again in about 5 minutes.");
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

describe("describeWait", () => {
    it("rounds a wait as people say it", () => {
        expect(describeWait(10)).toBe("about a minute");
        expect(describeWait(300)).toBe("about 5 minutes");
        expect(describeWait(3570)).toBe("about an hour");
        expect(describeWait(76620)).toBe("about 21 hours");
        expect(describeWait(86367)).toBe("about 24 hours");
        expect(describeWait(3 * 86400)).toBe("about 3 days");
    });
});

describe("readRetryAfterSeconds", () => {
    it("reads the wait back out of a rate limit's message", () => {
        expect(
            readRetryAfterSeconds(new OnshapeRateLimitError("slow down", 90))
        ).toBe(90);
        expect(readRetryAfterSeconds(new Error("boom"))).toBeUndefined();
    });
});
