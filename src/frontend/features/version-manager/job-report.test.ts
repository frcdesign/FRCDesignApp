import { describe, expect, it } from "vitest";
import {
    emptyJobResult,
    VersionJobKind,
    VersionJobState,
    type VersionJobResult
} from "@backend/features/version-manager/contract";
import { jobHeadline, JobOutcome, jobOutcome, jobStats } from "./job-report";

function result(update: Partial<VersionJobResult>): VersionJobResult {
    return { ...emptyJobResult(), ...update };
}

describe("jobOutcome", () => {
    it("has nothing to report while a run is going", () => {
        expect(jobOutcome({ state: VersionJobState.RUNNING })).toBeUndefined();
        expect(jobOutcome(undefined)).toBeUndefined();
    });

    it("calls a run that stopped after changing something partial", () => {
        expect(
            jobOutcome({
                state: VersionJobState.FAILED,
                result: result({ createdVersions: 1 })
            })
        ).toBe(JobOutcome.PARTIAL);
        expect(
            jobOutcome({ state: VersionJobState.FAILED, result: result({}) })
        ).toBe(JobOutcome.FAILED);
        expect(
            jobOutcome({ state: VersionJobState.COMPLETE, result: result({}) })
        ).toBe(JobOutcome.SUCCESS);
    });
});

describe("jobHeadline", () => {
    it("names the run and how it went", () => {
        const status = {
            state: VersionJobState.COMPLETE,
            kind: VersionJobKind.PULL
        };
        expect(jobHeadline(status, JobOutcome.SUCCESS)).toBe("Pull succeeded");
        expect(jobHeadline(status, JobOutcome.PARTIAL)).toBe(
            "Pull partially succeeded"
        );
        expect(
            jobHeadline({ state: VersionJobState.FAILED }, JobOutcome.FAILED)
        ).toBe("Run failed");
    });
});

describe("jobStats", () => {
    it("counts what the run did, leaving out what it did none of", () => {
        expect(
            jobStats(
                result({
                    createdVersions: 1,
                    reusedVersions: 2,
                    updatedElements: 5
                })
            ).map((stat) => stat.label)
        ).toEqual(["1 version created", "2 versions reused", "5 tabs updated"]);
        expect(jobStats(result({}))).toEqual([]);
    });
});
