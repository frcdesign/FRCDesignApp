import { describe, expect, it } from "vitest";
import {
    emptyJobResult,
    jobOutcome,
    nextVersionName,
    toWorkspacePath,
    VersionJobOutcome,
    VersionJobState,
    VersionTaskAction,
    VersionTaskState,
    type VersionJobResult,
    type VersionTask
} from "./contract";

describe("nextVersionName", () => {
    it("starts at V1 in a document with no versions of its own", () => {
        expect(nextVersionName([])).toBe("V1");
    });

    it("follows the highest number, not the count", () => {
        expect(nextVersionName(["V1", "V2", "V3"])).toBe("V4");
        // A version deleted from the middle must not hand its number out again.
        expect(nextVersionName(["V1", "V3"])).toBe("V4");
    });

    it("ignores the names Onshape and people give versions", () => {
        expect(nextVersionName(["Start", "Week 3 release", "V2"])).toBe("V3");
        expect(nextVersionName(["Start", "Competition ready"])).toBe("V1");
    });

    it("takes only a bare V and a number", () => {
        // "V2 rev b" is somebody's name that happens to start with one.
        expect(nextVersionName(["V10", "V2 rev b", "Version 20"])).toBe("V11");
    });

    it("reads a name Onshape padded with spaces", () => {
        expect(nextVersionName([" V7 "])).toBe("V8");
    });
});

describe("jobOutcome", () => {
    const result = (update: Partial<VersionJobResult>): VersionJobResult => ({
        ...emptyJobResult(),
        ...update
    });
    const task = (state: VersionTaskState): VersionTask => ({
        workspace: toWorkspacePath("practice", "practice-w"),
        action: VersionTaskAction.REFERENCES,
        state
    });
    const changed = result({ createdVersions: 1 });

    it("has nothing to report while a run is going", () => {
        expect(jobOutcome({ state: VersionJobState.RUNNING })).toBeUndefined();
        expect(jobOutcome(undefined)).toBeUndefined();
    });

    it("succeeds when every step did", () => {
        expect(
            jobOutcome({
                state: VersionJobState.COMPLETE,
                tasks: [task(VersionTaskState.DONE)],
                result: result({})
            })
        ).toBe(VersionJobOutcome.SUCCESS);
    });

    it("is partial when a step failed after something changed", () => {
        const failedStep = [task(VersionTaskState.FAILED)];
        expect(
            jobOutcome({
                state: VersionJobState.COMPLETE,
                tasks: failedStep,
                result: changed
            })
        ).toBe(VersionJobOutcome.PARTIAL);
        expect(
            jobOutcome({ state: VersionJobState.FAILED, result: changed })
        ).toBe(VersionJobOutcome.PARTIAL);
    });

    it("fails when nothing changed", () => {
        expect(
            jobOutcome({
                state: VersionJobState.COMPLETE,
                tasks: [task(VersionTaskState.FAILED)],
                result: result({})
            })
        ).toBe(VersionJobOutcome.FAILED);
        expect(jobOutcome({ state: VersionJobState.FAILED })).toBe(
            VersionJobOutcome.FAILED
        );
    });
});
