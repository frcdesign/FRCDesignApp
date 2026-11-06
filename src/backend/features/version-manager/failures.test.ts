import { describe, expect, it } from "vitest";
import { OnshapeApiError } from "../../lib/onshape/client";
import { describeRunFailure, describeStepFailure } from "./failures";
import { VersionTaskAction } from "./contract";

function apiError(status: number, body = ""): OnshapeApiError {
    return new OnshapeApiError(`Onshape API error ${status}: ${body}`, status);
}

describe("describeStepFailure", () => {
    // As Workflows rebuilds the step's error: its name, then its message.
    const reported = (error: unknown, action: VersionTaskAction) =>
        describeRunFailure(
            new Error(
                `NonRetryableError: ${describeStepFailure(error, action)}`
            )
        );
    const refusal = apiError(400, JSON.stringify({ message: "Bad ref" }));

    it("never passes Onshape's own message on", () => {
        expect(reported(refusal, VersionTaskAction.REFERENCES)).not.toContain(
            "Bad ref"
        );
    });

    it("says what was refused in its own words", () => {
        expect(reported(apiError(403), VersionTaskAction.REFERENCES)).toBe(
            "You don't have permission to edit this document."
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
