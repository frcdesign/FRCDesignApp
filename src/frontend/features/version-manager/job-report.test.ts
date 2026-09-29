import { describe, expect, it } from "vitest";
import {
    emptyJobResult,
    VersionJobKind,
    VersionJobState,
    type VersionJobResult
} from "@backend/features/version-manager/contract";
import { describeJob, JobOutcome, jobOutcome } from "./job-report";

function result(update: Partial<VersionJobResult>): VersionJobResult {
    return { ...emptyJobResult(), ...update };
}

describe("jobOutcome", () => {
    it("has nothing to report while a run is going", () => {
        expect(jobOutcome({ state: VersionJobState.RUNNING })).toBeUndefined();
        expect(jobOutcome(undefined)).toBeUndefined();
    });

    it("calls a run that finished with refused tabs partial", () => {
        expect(
            jobOutcome({
                state: VersionJobState.COMPLETE,
                result: result({ failedElements: 1 })
            })
        ).toBe(JobOutcome.PARTIAL);
        expect(
            jobOutcome({ state: VersionJobState.COMPLETE, result: result({}) })
        ).toBe(JobOutcome.SUCCESS);
    });
});

describe("describeJob", () => {
    it("says what a run did", () => {
        expect(
            describeJob({
                state: VersionJobState.COMPLETE,
                result: result({
                    createdVersions: 1,
                    updatedElements: 5,
                    updatedWorkspaces: 2
                })
            })
        ).toBe("Created 1 version and updated 5 tabs in 2 workspaces.");
    });

    it("says when there was nothing to do", () => {
        expect(
            describeJob({ state: VersionJobState.COMPLETE, result: result({}) })
        ).toBe("Everything was already up to date.");
    });

    it("counts the tabs Onshape refused", () => {
        expect(
            describeJob({
                state: VersionJobState.COMPLETE,
                result: result({ failedElements: 2 })
            })
        ).toBe("Nothing was updated. 2 tabs couldn't be updated.");
    });

    it("says why a run stopped and what it had already done", () => {
        expect(
            describeJob({
                state: VersionJobState.FAILED,
                kind: VersionJobKind.PUSH,
                error: "Onshape was having problems, so the run stopped.",
                result: result({ createdVersions: 2 })
            })
        ).toBe(
            "Onshape was having problems, so the run stopped. Before it stopped, it created 2 versions."
        );
    });
});
